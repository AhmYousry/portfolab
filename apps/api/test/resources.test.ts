import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { listZipFiles } from '../src/routes/resources.js'
import { env } from '../src/env.js'
import path from 'node:path'
import {
  app,
  createPublishedProProject,
  grantEntitlement,
  lessonBySlug,
  resetDb,
  seedContent,
  signedUpClient,
} from './helpers.js'

let proResourceId = ''

beforeAll(async () => {
  await resetDb()
  await seedContent()
  const pro = await createPublishedProProject()
  proResourceId = pro.resources[0]?.id ?? ''
})

async function resourceId(key: string) {
  return (await prisma.resource.findUniqueOrThrow({ where: { key } })).id
}

function binaryParser(res: request.Response, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = []
  res.on('data', (c: Buffer) => chunks.push(c))
  res.on('end', () => cb(null, Buffer.concat(chunks)))
}

describe('resources', () => {
  it('requires login to list or download', async () => {
    expect((await request(app).get('/api/resources')).status).toBe(401)
    const id = await resourceId('taskflow-brief')
    expect((await request(app).get(`/api/resources/${id}/download`)).status).toBe(401)
  })

  it('free student downloads free documents', async () => {
    const { client } = await signedUpClient()
    const res = await client.get(`/api/resources/${await resourceId('taskflow-prompts')}/download`)
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('ai-prompts.md')
    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.text).toContain('F10')
  })

  it('starter zip downloads and never includes .env or node_modules', async () => {
    const { client } = await signedUpClient()
    const res = await client
      .get(`/api/resources/${await resourceId('taskflow-starter')}/download`)
      .buffer(true)
      .parse(binaryParser)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('zip')
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK')

    const files = listZipFiles(path.resolve(env.contentDir, '..', 'examples/taskflow-lite/starter'))
    expect(files.some((f) => f.endsWith('.env.example'))).toBe(true)
    expect(files.some((f) => /(^|[\\/])\.env(\.test)?$/.test(f))).toBe(false)
    expect(files.some((f) => f.includes('node_modules'))).toBe(false)
  })

  it('reference solution is locked until the crud-endpoints checkpoints are complete', async () => {
    const { client } = await signedUpClient()
    const refId = await resourceId('taskflow-reference')

    const list = await client.get('/api/resources')
    const ref = list.body.data.resources.find((r: { id: string }) => r.id === refId)
    expect(ref).toMatchObject({ locked: true })
    expect((await client.get(`/api/resources/${refId}/download`)).status).toBe(403)

    const lesson = await lessonBySlug('taskflow-lite', 'crud-endpoints')
    for (const cp of lesson.checkpoints)
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })

    const unlocked = await client.get('/api/resources')
    expect(unlocked.body.data.resources.find((r: { id: string }) => r.id === refId)).toMatchObject({
      locked: false,
    })
    const dl = await client.get(`/api/resources/${refId}/download`).buffer(true).parse(binaryParser)
    expect(dl.status).toBe(200)
  })

  it('free student cannot download a pro resource by id; entitled student can', async () => {
    const { client, userId } = await signedUpClient()
    expect((await client.get(`/api/resources/${proResourceId}/download`)).status).toBe(403)
    await grantEntitlement(userId)
    expect((await client.get(`/api/resources/${proResourceId}/download`)).status).toBe(200)
  })

  it('unpublished resources are hidden', async () => {
    const id = await resourceId('taskflow-worksheet')
    await prisma.resource.update({ where: { id }, data: { status: 'DRAFT' } })
    const { client } = await signedUpClient()
    expect((await client.get(`/api/resources/${id}/download`)).status).toBe(404)
    await prisma.resource.update({ where: { id }, data: { status: 'PUBLISHED' } })
  })

  it('storage keys cannot escape the content directory', async () => {
    const id = await resourceId('taskflow-brief')
    await prisma.resource.update({ where: { id }, data: { storageKey: '../../apps/api/.env' } })
    const { client } = await signedUpClient()
    expect((await client.get(`/api/resources/${id}/download`)).status).toBe(404)
    await prisma.resource.update({
      where: { id },
      data: { storageKey: 'taskflow-lite/project-brief.md' },
    })
  })
})
