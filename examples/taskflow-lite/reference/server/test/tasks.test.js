import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'

const app = createApp({ clientOrigin: 'http://localhost:5174' })

async function createTask(body) {
  const res = await request(app).post('/api/tasks').send(body)
  expect(res.status).toBe(201)
  return res.body.data
}

beforeEach(async () => {
  await prisma.task.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/health', () => {
  it('reports the database is up', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', database: 'up' })
  })
})

describe('POST /api/tasks', () => {
  it('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '  Write README  ' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      title: 'Write README',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
    })
    expect(res.body.data.id).toBeTypeOf('string')
  })

  it('stores the due date as a plain date', async () => {
    const task = await createTask({ title: 'Deploy', dueDate: '2026-12-01', priority: 'HIGH' })
    expect(task.dueDate).toBe('2026-12-01')
  })

  it.each([
    [{}, 'title'],
    [{ title: '' }, 'title'],
    [{ title: 'x'.repeat(121) }, 'title'],
    [{ title: 'ok', status: 'DOING' }, 'status'],
    [{ title: 'ok', dueDate: '01/12/2026' }, 'dueDate'],
    [{ title: 'ok', isAdmin: true }, ''],
  ])('rejects invalid body %j with 400', async (body, field) => {
    const res = await request(app).post('/api/tasks').send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Validation failed')
    if (field) expect(res.body.error.details.map((d) => d.field)).toContain(field)
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": ')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/tasks', () => {
  beforeEach(async () => {
    await createTask({ title: 'Buy milk', priority: 'LOW', dueDate: '2026-12-10' })
    await createTask({
      title: 'Fix login bug',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-12-01',
    })
    await createTask({ title: 'Read docs', status: 'DONE' })
  })

  it('lists all tasks, newest first by default', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)
    expect(res.body.data.map((t) => t.title)).toEqual(['Read docs', 'Fix login bug', 'Buy milk'])
  })

  it('filters by status and priority', async () => {
    const byStatus = await request(app).get('/api/tasks?status=DONE')
    expect(byStatus.body.data.map((t) => t.title)).toEqual(['Read docs'])
    const byPriority = await request(app).get('/api/tasks?priority=HIGH')
    expect(byPriority.body.data.map((t) => t.title)).toEqual(['Fix login bug'])
  })

  it('searches title case-insensitively', async () => {
    const res = await request(app).get('/api/tasks?search=LOGIN')
    expect(res.body.data.map((t) => t.title)).toEqual(['Fix login bug'])
  })

  it('sorts by due date with empty dates last', async () => {
    const res = await request(app).get('/api/tasks?sort=dueDate')
    expect(res.body.data.map((t) => t.title)).toEqual(['Fix login bug', 'Buy milk', 'Read docs'])
  })

  it('rejects unknown filter values', async () => {
    const res = await request(app).get('/api/tasks?status=SOMEDAY')
    expect(res.status).toBe(400)
  })
})

describe('GET/PATCH/DELETE /api/tasks/:id', () => {
  it('returns one task', async () => {
    const task = await createTask({ title: 'One' })
    const res = await request(app).get(`/api/tasks/${task.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('One')
  })

  it('returns 404 for a missing task', async () => {
    const res = await request(app).get('/api/tasks/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('marks a task done and clears its due date', async () => {
    const task = await createTask({ title: 'Ship it', dueDate: '2026-12-24' })
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .send({ status: 'DONE', dueDate: null })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'DONE', dueDate: null, title: 'Ship it' })
  })

  it('only changes the fields that were sent', async () => {
    const task = await createTask({ title: 'Keep me', status: 'IN_PROGRESS', priority: 'HIGH' })
    const res = await request(app).patch(`/api/tasks/${task.id}`).send({ title: 'Renamed' })
    expect(res.body.data).toMatchObject({
      title: 'Renamed',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    })
  })

  it('rejects an empty update', async () => {
    const task = await createTask({ title: 'Ship it' })
    const res = await request(app).patch(`/api/tasks/${task.id}`).send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 when updating a missing task', async () => {
    const res = await request(app).patch('/api/tasks/nope').send({ title: 'x' })
    expect(res.status).toBe(404)
  })

  it('deletes a task, then 404s', async () => {
    const task = await createTask({ title: 'Temp' })
    const first = await request(app).delete(`/api/tasks/${task.id}`)
    expect(first.status).toBe(204)
    const second = await request(app).delete(`/api/tasks/${task.id}`)
    expect(second.status).toBe(404)
  })
})

describe('database failures', () => {
  it('returns a safe 500 without leaking internals', async () => {
    const spy = vi
      .spyOn(prisma.task, 'findMany')
      .mockRejectedValueOnce(new Error('connection refused at 10.0.0.5'))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: { message: 'Something went wrong' } })
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5')
    spy.mockRestore()
    errorLog.mockRestore()
  })
})
