import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { setAnalyticsSink } from '../src/services/product-analytics.js'
import { purgeExpiredAnalytics } from '../src/services/retention.js'
import {
  Client,
  createPublishedProProject,
  grantEntitlement,
  lessonBySlug,
  resetDb,
  seedContent,
  signedUpClient,
} from './helpers.js'

interface Captured {
  distinctId: string
  event: string
  properties: Record<string, string | number | boolean>
}
const captured: Captured[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent()
  await createPublishedProProject()
  setAnalyticsSink({
    capture: (distinctId, event, properties) =>
      void captured.push({ distinctId, event, properties }),
    shutdown: async () => undefined,
  })
})

beforeEach(() => {
  captured.length = 0
})

async function consenting() {
  const s = await signedUpClient()
  await s.client.put('/api/me/analytics-consent', { analytics: true })
  return s
}

const mine = (userId: string, event: string) =>
  captured.filter((c) => c.distinctId === userId && c.event === event)

describe('lesson events are emitted once per user and lesson', () => {
  it('lesson_completed does not re-fire after un-checking and re-checking a checkpoint (M-2)', async () => {
    const { client, userId } = await consenting()
    const lesson = await lessonBySlug('taskflow-lite', 'why-taskflow')
    for (const cp of lesson.checkpoints) {
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    }
    const first = lesson.checkpoints[0]
    if (!first) throw new Error('fixture')
    for (let i = 0; i < 3; i++) {
      await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'NOT_STARTED' })
      await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'COMPLETED' })
    }
    expect(mine(userId, 'lesson_completed')).toHaveLength(1)
    expect(mine(userId, 'checkpoint_completed')).toHaveLength(lesson.checkpoints.length)
    expect(
      mine(userId, 'checkpoint_completed')
        .map((c) => c.properties.checkpoint_id)
        .sort(),
    ).toEqual(lesson.checkpoints.map((c) => c.key).sort())
    const firstParty = await prisma.leadEvent.count({
      where: { userId, event: 'checkpoint_completed' },
    })
    expect(firstParty).toBe(lesson.checkpoints.length)
  })

  it('lesson_started comes only from the server, once, in both PostHog and first-party (M-1, M-3)', async () => {
    const { client, userId } = await consenting()
    const lesson = await lessonBySlug('taskflow-lite', 'architecture')
    await client.put(`/api/lessons/${lesson.id}/progress`, { status: 'IN_PROGRESS' })
    await client.put(`/api/lessons/${lesson.id}/progress`, { status: 'NOT_STARTED' })
    await client.put(`/api/lessons/${lesson.id}/progress`, { status: 'IN_PROGRESS' })
    expect(mine(userId, 'lesson_started')).toEqual([
      expect.objectContaining({
        properties: { project_id: 'taskflow-lite', lesson_id: 'architecture' },
      }),
    ])
    expect(
      await prisma.leadEvent.count({ where: { userId, event: 'lesson_started', path: lesson.id } }),
    ).toBe(1)
  })

  it('the browser can no longer post first-party lesson_started (single source)', async () => {
    const anon = await new Client().init()
    const res = await anon.post('/api/analytics/events', { event: 'lesson_started' })
    expect(res.status).toBe(400)
  })
})

describe('project events are race-safe (L-1)', () => {
  it('parallel enroll requests produce exactly one free_project_started and one enrollment event', async () => {
    const { client, userId } = await consenting()
    const results = await Promise.all(
      Array.from({ length: 6 }, () => client.post('/api/projects/taskflow-lite/enroll')),
    )
    expect(results.every((r) => r.status === 201)).toBe(true)
    expect(mine(userId, 'free_project_started')).toHaveLength(1)
    expect(await prisma.leadEvent.count({ where: { userId, event: 'project_enrolled' } })).toBe(1)
    expect(await prisma.enrollment.count({ where: { userId } })).toBe(1)
  })

  it('parallel completion of the final checkpoint yields one project_completed', async () => {
    const { client, userId } = await consenting()
    const lessons = await prisma.lesson.findMany({
      where: { module: { project: { slug: 'taskflow-lite' } } },
      include: { checkpoints: true },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    })
    const all = lessons.flatMap((l) => l.checkpoints)
    const last = all.pop()
    if (!last) throw new Error('fixture')
    for (const cp of all)
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    await Promise.all(
      Array.from({ length: 5 }, () =>
        client.put(`/api/checkpoints/${last.id}/progress`, { status: 'COMPLETED' }),
      ),
    )
    expect(mine(userId, 'project_completed')).toHaveLength(1)
    expect(
      await prisma.leadEvent.count({ where: { userId, event: 'free_project_completed' } }),
    ).toBe(1)
  })

  it('Pro enrollment emits pro_project_started (L-7)', async () => {
    const { client, userId } = await consenting()
    await grantEntitlement(userId)
    const res = await client.post('/api/projects/pro-fixture/enroll')
    expect(res.status).toBe(201)
    expect(mine(userId, 'pro_project_started')).toEqual([
      expect.objectContaining({ properties: { project_id: 'pro-fixture', source: 'enrollment' } }),
    ])
    expect(mine(userId, 'free_project_started')).toEqual([])
  })
})

describe('resource_downloaded (L-7)', () => {
  it('is emitted only for authorized downloads, keyed by the stable resource key', async () => {
    const { client, userId } = await consenting()
    const prompts = await prisma.resource.findUniqueOrThrow({ where: { key: 'taskflow-prompts' } })
    expect((await client.get(`/api/resources/${prompts.id}/download`)).status).toBe(200)
    expect(mine(userId, 'resource_downloaded')).toEqual([
      expect.objectContaining({
        properties: { resource_id: 'taskflow-prompts', project_id: 'taskflow-lite', plan: 'free' },
      }),
    ])

    const reference = await prisma.resource.findUniqueOrThrow({
      where: { key: 'taskflow-reference' },
    })
    expect((await client.get(`/api/resources/${reference.id}/download`)).status).toBe(403)
    expect(mine(userId, 'resource_downloaded')).toHaveLength(1)
  })

  it('resources list exposes the stable key used by the client click event', async () => {
    const { client } = await signedUpClient()
    const res = await client.get('/api/resources')
    expect(res.body.data.resources.map((r: { key: string }) => r.key)).toContain('taskflow-prompts')
  })
})

describe('dedupe survives retention (L-2) and the migration backfill', () => {
  it('purging first-party events does not let project_completed fire again', async () => {
    const { client, userId } = await consenting()
    const lessons = await prisma.lesson.findMany({
      where: { module: { project: { slug: 'taskflow-lite' } } },
      include: { checkpoints: true },
    })
    for (const cp of lessons.flatMap((l) => l.checkpoints)) {
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    }
    expect(mine(userId, 'project_completed')).toHaveLength(1)

    await prisma.leadEvent.updateMany({
      where: { userId },
      data: { createdAt: new Date('2000-01-01') },
    })
    const purged = await purgeExpiredAnalytics()
    expect(purged.leadEvents).toBeGreaterThan(0)

    const first = lessons[0]?.checkpoints[0]
    if (!first) throw new Error('fixture')
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'NOT_STARTED' })
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'COMPLETED' })
    expect(mine(userId, 'project_completed')).toHaveLength(1)
  })

  it('backfill SQL recreates claims from existing progress so nothing re-fires after deploy', async () => {
    const { client, userId } = await consenting()
    const lesson = await lessonBySlug('taskflow-lite', 'setup-workspace')
    for (const cp of lesson.checkpoints) {
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    }
    await prisma.analyticsClaim.deleteMany({ where: { userId } })

    const dir = path.resolve('prisma/migrations')
    const migration = fs.readdirSync(dir).find((d) => d.endsWith('_analytics_claims'))
    if (!migration) throw new Error('migration missing')
    const sql = fs.readFileSync(path.join(dir, migration, 'migration.sql'), 'utf8')
    const backfill = sql.slice(sql.indexOf('-- Backfill'))
    for (const statement of backfill.split(';').map((s) => s.replace(/--.*$/gm, '').trim())) {
      if (statement) await prisma.$executeRawUnsafe(statement)
    }

    const claims = await prisma.analyticsClaim.groupBy({
      by: ['event'],
      where: { userId },
      _count: true,
    })
    const counts = Object.fromEntries(claims.map((c) => [c.event, c._count]))
    expect(counts).toMatchObject({
      project_started: 1,
      lesson_started: 1,
      lesson_completed: 1,
      checkpoint_completed: lesson.checkpoints.length,
    })

    captured.length = 0
    const first = lesson.checkpoints[0]
    if (!first) throw new Error('fixture')
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'NOT_STARTED' })
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'COMPLETED' })
    expect(captured.filter((c) => c.distinctId === userId)).toEqual([])
  })
})
