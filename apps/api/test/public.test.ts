import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app, resetDb, seedContent } from './helpers.js'

beforeAll(async () => {
  await resetDb()
  await seedContent()
})

describe('public API', () => {
  it('GET /api/health returns JSON with database status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ data: { status: 'ok', database: 'up' }, error: null })
  })

  it('lists published and coming-soon projects without drafts', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(200)
    const projects = res.body.data.projects as {
      slug: string
      status: string
      tier: string
      lessonCount: number
    }[]
    expect(projects.map((p) => p.slug)).toEqual([
      'taskflow-lite',
      'expensepilot',
      'teamboard',
      'issueforge',
    ])
    expect(projects[0]).toMatchObject({ tier: 'FREE', status: 'PUBLISHED', lessonCount: 12 })
    for (const pro of projects.slice(1))
      expect(pro).toMatchObject({ tier: 'PRO', status: 'COMING_SOON', lessonCount: 0 })
  })

  it('curriculum lists lesson titles but never lesson bodies', async () => {
    const res = await request(app).get('/api/projects/taskflow-lite/curriculum')
    expect(res.status).toBe(200)
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('contentMarkdown')
    expect(text).not.toContain('## الهدف من الدرس')
    expect(res.body.data.modules).toHaveLength(6)
    expect(res.body.data.modules[0].lessons[0]).toMatchObject({
      slug: 'why-taskflow',
      isPreview: true,
    })
  })

  it('coming-soon project shows module outline but no lessons', async () => {
    const res = await request(app).get('/api/projects/expensepilot')
    expect(res.status).toBe(200)
    expect(res.body.data.project.status).toBe('COMING_SOON')
    for (const m of res.body.data.project.modules) expect(m.lessons).toEqual([])
  })

  it('unknown or invalid slug returns 404 / 400', async () => {
    expect((await request(app).get('/api/projects/nope')).status).toBe(404)
    expect((await request(app).get('/api/projects/Bad%20Slug')).status).toBe(400)
  })

  it('pricing is honest: Pro unavailable and checkout disabled', async () => {
    const res = await request(app).get('/api/pricing')
    const [free, pro] = res.body.data.tiers
    expect(free).toMatchObject({
      id: 'FREE',
      priceMinor: 0,
      available: true,
      checkoutEnabled: false,
    })
    expect(pro).toMatchObject({
      id: 'PRO',
      priceMinor: 24900,
      currency: 'EGP',
      isTestPrice: true,
      available: false,
      checkoutEnabled: false,
    })
  })

  it('unknown API route is a JSON 404, not an HTML fallback', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})
