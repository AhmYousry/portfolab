import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { WebDistError } from '../src/web-static.js'

const INDEX_HTML = '<!doctype html><html><body><div id="root">PORTFOLAB_SPA</div></body></html>'
const ASSET_JS = 'console.log("asset")'
const SECRET = 'TOP_SECRET_VALUE_DO_NOT_SERVE'

let root: string
let dist: string
let web: ReturnType<typeof createApp>

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-web-'))
  dist = path.join(root, 'dist')
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true })
  fs.mkdirSync(path.join(dist, '.git'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), INDEX_HTML)
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), ASSET_JS)
  fs.writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  fs.writeFileSync(path.join(dist, '.env'), `SESSION_SECRET=${SECRET}`)
  fs.writeFileSync(path.join(dist, '.git', 'config'), SECRET)
  fs.writeFileSync(path.join(root, 'outside.txt'), SECRET)
  web = createApp({ webDistDir: dist })
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function expectJson404(res: request.Response) {
  expect(res.status).toBe(404)
  expect(res.headers['content-type']).toMatch(/application\/json/)
  expect(res.body.error.code).toBe('NOT_FOUND')
  expect(res.text).not.toContain('PORTFOLAB_SPA')
  expect(res.text).not.toContain(SECRET)
}

describe('single-service web serving', () => {
  it('serves hashed assets with immutable caching', async () => {
    const res = await request(web).get('/assets/index-abc123.js')
    expect(res.status).toBe(200)
    expect(res.text).toBe(ASSET_JS)
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('serves root files with revalidation', async () => {
    const res = await request(web).get('/favicon.svg')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it.each(['/', '/projects/taskflow-lite', '/projects/taskflow-lite/lessons/intro', '/account'])(
    'falls back to index.html for the deep link %s',
    async (url) => {
      const res = await request(web).get(url).set('Accept', 'text/html')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/html/)
      expect(res.headers['cache-control']).toBe('no-cache')
      expect(res.text).toContain('PORTFOLAB_SPA')
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    },
  )

  it('answers HEAD for a deep link', async () => {
    const res = await request(web).head('/dashboard').set('Accept', 'text/html')
    expect(res.status).toBe(200)
  })

  it('keeps API 404s as JSON even for HTML navigations', async () => {
    for (const url of ['/api', '/api/does-not-exist', '/api/auth/nope/deeper']) {
      expectJson404(await request(web).get(url).set('Accept', 'text/html'))
    }
  })

  it('still serves real API routes', async () => {
    const res = await request(web).get('/api/auth/csrf')
    expect(res.status).toBe(200)
    expect(res.body.data.csrfToken).toBeTruthy()
  })

  it.each(['/.env', '/.git/config', '/assets/.env', '/.well-known/x'])(
    'never serves dotfiles or dot directories: %s',
    async (url) => {
      expectJson404(await request(web).get(url).set('Accept', 'text/html'))
    },
  )

  it.each([
    '/src/server.ts',
    '/apps/api/src/env.ts',
    '/package.json',
    '/assets/missing-file.js',
    '/index.html.map',
  ])('does not expose source or fall back to HTML for file paths: %s', async (url) => {
    expectJson404(await request(web).get(url).set('Accept', 'text/html'))
  })

  it.each(['/..%2foutside.txt', '/assets/..%2f..%2foutside.txt', '/%2e%2e/outside.txt'])(
    'blocks traversal outside the dist directory: %s',
    async (url) => {
      const res = await request(web).get(url).set('Accept', 'text/html')
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
      expect(res.text).not.toContain(SECRET)
    },
  )

  it('does not fall back to HTML for non-GET requests', async () => {
    const res = await request(web).delete('/projects/taskflow-lite').set('Accept', 'text/html')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.text).not.toContain('PORTFOLAB_SPA')
  })

  it('refuses to start without a built index.html', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-empty-'))
    try {
      expect(() => createApp({ webDistDir: empty })).toThrow(WebDistError)
    } finally {
      fs.rmSync(empty, { recursive: true, force: true })
    }
  })

  it('keeps the API-only behavior when no web dist is configured', async () => {
    const apiOnly = createApp()
    expectJson404(await request(apiOnly).get('/projects/taskflow-lite').set('Accept', 'text/html'))
  })
})
