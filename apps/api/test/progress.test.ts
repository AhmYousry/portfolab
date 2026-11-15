import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { Client, PASSWORD, lessonBySlug, resetDb, seedContent, signedUpClient } from './helpers.js'

beforeAll(async () => {
  await resetDb()
  await seedContent()
})

describe('enrollment and progress', () => {
  it('enroll → open lesson → complete checkpoints → progress persists after logout/login', async () => {
    const { client, email, userId } = await signedUpClient()

    const enroll = await client.post('/api/projects/taskflow-lite/enroll')
    expect(enroll.status).toBe(201)
    const again = await client.post('/api/projects/taskflow-lite/enroll')
    expect(again.status).toBe(201)
    expect(await prisma.enrollment.count({ where: { userId } })).toBe(1)

    const lesson = await lessonBySlug('taskflow-lite', 'setup-workspace')
    const start = await client.put(`/api/lessons/${lesson.id}/progress`, { status: 'IN_PROGRESS' })
    expect(start.status).toBe(200)

    for (const [index, cp] of lesson.checkpoints.entries()) {
      const res = await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
      expect(res.status).toBe(200)
      const isLast = index === lesson.checkpoints.length - 1
      expect(res.body.data.lesson.status).toBe(isLast ? 'COMPLETED' : 'IN_PROGRESS')
    }

    await client.post('/api/auth/logout')
    const fresh = await new Client().init()
    await fresh.post('/api/auth/login', { email, password: PASSWORD })

    const view = await fresh.get('/api/projects/taskflow-lite/lessons/setup-workspace')
    expect(view.body.data.lesson.progressStatus).toBe('COMPLETED')
    expect(
      view.body.data.lesson.checkpoints.every((c: { completed: boolean }) => c.completed),
    ).toBe(true)

    const dashboard = await fresh.get('/api/me/dashboard')
    expect(dashboard.status).toBe(200)
    const [project] = dashboard.body.data.projects
    expect(project).toMatchObject({ completedLessons: 1, totalLessons: 12 })
    expect(project.nextLesson.slug).toBe('why-taskflow')
    expect(dashboard.body.data.stats.completedCheckpoints).toBe(lesson.checkpoints.length)

    const events = await prisma.leadEvent.groupBy({
      by: ['event'],
      where: { userId },
      _count: { _all: true },
    })
    const names = events.map((e) => e.event).sort()
    expect(names).toEqual([
      'checkpoint_completed',
      'lesson_started',
      'project_enrolled',
      'signup_complete',
    ])
  })

  it('un-completing a checkpoint moves the lesson back to IN_PROGRESS', async () => {
    const { client } = await signedUpClient()
    const lesson = await lessonBySlug('taskflow-lite', 'why-taskflow')
    for (const cp of lesson.checkpoints)
      await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    const first = lesson.checkpoints[0]
    if (!first) throw new Error('fixture missing checkpoint')
    const res = await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'NOT_STARTED' })
    expect(res.body.data.lesson.status).toBe('IN_PROGRESS')
  })

  it('completing every lesson records free_project_completed exactly once', async () => {
    const { client, userId } = await signedUpClient()
    const lessons = await prisma.lesson.findMany({
      where: { module: { project: { slug: 'taskflow-lite' } } },
      include: { checkpoints: true },
    })
    for (const lesson of lessons) {
      for (const cp of lesson.checkpoints)
        await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    }
    const last = lessons[0]
    if (!last) throw new Error('no lessons')
    await client.put(`/api/lessons/${last.id}/progress`, { status: 'COMPLETED' })

    const progress = await client.get('/api/me/progress')
    expect(progress.body.data.projects[0]).toMatchObject({ percent: 100, nextLesson: null })
    expect(
      await prisma.leadEvent.count({ where: { userId, event: 'free_project_completed' } }),
    ).toBe(1)
  })

  it('validates progress input and ids', async () => {
    const { client } = await signedUpClient()
    const lesson = await lessonBySlug('taskflow-lite', 'why-taskflow')
    expect(
      (await client.put(`/api/lessons/${lesson.id}/progress`, { status: 'DONE' })).status,
    ).toBe(400)
    expect(
      (await client.put('/api/lessons/does-not-exist/progress', { status: 'COMPLETED' })).status,
    ).toBe(404)
    expect(
      (await client.put('/api/checkpoints/does-not-exist/progress', { status: 'COMPLETED' }))
        .status,
    ).toBe(404)
  })

  it('anonymous users cannot write progress', async () => {
    const anon = await new Client().init()
    const lesson = await lessonBySlug('taskflow-lite', 'why-taskflow')
    expect(
      (await anon.put(`/api/lessons/${lesson.id}/progress`, { status: 'COMPLETED' })).status,
    ).toBe(401)
  })
})
