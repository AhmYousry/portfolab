import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import {
  app,
  createPublishedProProject,
  grantEntitlement,
  makeAdmin,
  resetDb,
  seedContent,
  signedUpClient,
} from './helpers.js'

let proLessonId = ''

beforeAll(async () => {
  await resetDb()
  await seedContent()
  const pro = await createPublishedProProject()
  proLessonId = pro.modules[0]?.lessons[0]?.id ?? ''
})

describe('free project lessons', () => {
  it('preview lesson is readable anonymously', async () => {
    const res = await request(app).get('/api/projects/taskflow-lite/lessons/why-taskflow')
    expect(res.status).toBe(200)
    expect(res.body.data.lesson.contentMarkdown).toContain('الهدف من الدرس')
    expect(res.body.data.lesson.progressStatus).toBeNull()
  })

  it('non-preview lesson requires login (401) and works for a free student', async () => {
    const anon = await request(app).get('/api/projects/taskflow-lite/lessons/crud-endpoints')
    expect(anon.status).toBe(401)
    expect(JSON.stringify(anon.body)).not.toContain('contentMarkdown')

    const { client } = await signedUpClient()
    const res = await client.get('/api/projects/taskflow-lite/lessons/crud-endpoints')
    expect(res.status).toBe(200)
    expect(res.body.data.lesson.checkpoints).toHaveLength(3)
    expect(res.body.data.lesson.prev.slug).toBe('api-contract')
    expect(res.body.data.lesson.next.slug).toBe('components')
  })
})

describe('pro content', () => {
  it('anonymous gets 401, free student 403, entitled student 200', async () => {
    const path = '/api/projects/pro-fixture/lessons/paid-lesson'
    const anon = await request(app).get(path)
    expect(anon.status).toBe(401)

    const { client, userId } = await signedUpClient()
    const free = await client.get(path)
    expect(free.status).toBe(403)
    expect(JSON.stringify(free.body)).not.toContain('SECRET PRO CONTENT')

    await grantEntitlement(userId)
    const paid = await client.get(path)
    expect(paid.status).toBe(200)
    expect(paid.body.data.lesson.contentMarkdown).toBe('SECRET PRO CONTENT')
  })

  it('isPreview does not unlock pro lessons for anonymous visitors', async () => {
    const res = await request(app).get('/api/projects/pro-fixture/lessons/paid-preview')
    expect(res.status).toBe(401)
  })

  it('a revoked entitlement no longer grants access', async () => {
    const { client, userId } = await signedUpClient()
    await grantEntitlement(userId)
    await prisma.entitlement.updateMany({ where: { userId }, data: { revokedAt: new Date() } })
    expect((await client.get('/api/projects/pro-fixture/lessons/paid-lesson')).status).toBe(403)
  })

  it('free student cannot write progress on a pro lesson by guessing its id', async () => {
    const { client } = await signedUpClient()
    const res = await client.put(`/api/lessons/${proLessonId}/progress`, { status: 'COMPLETED' })
    expect(res.status).toBe(403)
    const checkpoint = await prisma.checkpoint.findFirstOrThrow({
      where: { lessonId: proLessonId },
    })
    const cp = await client.put(`/api/checkpoints/${checkpoint.id}/progress`, {
      status: 'COMPLETED',
    })
    expect(cp.status).toBe(403)
  })

  it('free student cannot enroll in a pro project', async () => {
    const { client } = await signedUpClient()
    expect((await client.post('/api/projects/pro-fixture/enroll')).status).toBe(403)
  })

  it('only one active entitlement per user and tier is allowed by the database', async () => {
    const { userId } = await signedUpClient()
    await grantEntitlement(userId)
    await expect(grantEntitlement(userId)).rejects.toThrow()
  })
})

describe('draft and coming-soon content', () => {
  it('draft lesson returns 404 even to entitled students', async () => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug: 'testing' } })
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: 'DRAFT' } })

    const { client, userId } = await signedUpClient()
    await grantEntitlement(userId)
    expect((await client.get('/api/projects/taskflow-lite/lessons/testing')).status).toBe(404)

    const curriculum = await request(app).get('/api/projects/taskflow-lite/curriculum')
    expect(JSON.stringify(curriculum.body)).not.toContain('"testing"')

    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: 'PUBLISHED' } })
  })

  it('admins also cannot read drafts through the student endpoint (preview is admin-only route)', async () => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug: 'testing' } })
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: 'DRAFT' } })
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    expect((await client.get('/api/projects/taskflow-lite/lessons/testing')).status).toBe(404)
    expect((await client.get(`/api/admin/lessons/${lesson.id}/preview`)).status).toBe(200)
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: 'PUBLISHED' } })
  })
})
