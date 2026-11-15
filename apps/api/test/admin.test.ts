import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { app, makeAdmin, resetDb, seedContent, signedUpClient } from './helpers.js'

const ADMIN_GETS = [
  '/api/admin/overview',
  '/api/admin/projects',
  '/api/admin/users',
  '/api/admin/orders',
  '/api/admin/analytics',
  '/api/admin/analytics?format=csv',
  '/api/admin/audit-log',
]

beforeAll(async () => {
  await resetDb()
  await seedContent()
})

describe('admin authorization', () => {
  it.each(ADMIN_GETS)('anonymous → 401, student → 403 on %s', async (path) => {
    expect((await request(app).get(path)).status).toBe(401)
    const { client } = await signedUpClient()
    expect((await client.get(path)).status).toBe(403)
  })

  it('student cannot change status or import content', async () => {
    const { client } = await signedUpClient()
    const project = await prisma.project.findUniqueOrThrow({ where: { slug: 'expensepilot' } })
    const res = await client.patch(`/api/admin/projects/${project.id}/status`, {
      status: 'PUBLISHED',
      confirm: true,
    })
    expect(res.status).toBe(403)
    expect((await client.post('/api/admin/content/import')).status).toBe(403)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status).toBe(
      'COMING_SOON',
    )
  })
})

describe('admin features', () => {
  it('admin sees all content including drafts and masks user emails', async () => {
    const { client, userId } = await signedUpClient({ email: 'boss@example.test' })
    await makeAdmin(userId)
    const projects = await client.get('/api/admin/projects')
    expect(projects.status).toBe(200)
    expect(projects.body.data.projects).toHaveLength(4)

    const users = await client.get('/api/admin/users')
    expect(users.status).toBe(200)
    expect(users.body.meta).toMatchObject({ page: 1, pageSize: 20 })
    expect(users.body.data.users[0].email).toMatch(/^\w{0,2}\*\*\*@/)
    expect(JSON.stringify(users.body)).not.toContain('passwordHash')
  })

  it('status change requires confirm and writes an audit log entry', async () => {
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug: 'testing' } })

    const noConfirm = await client.patch(`/api/admin/lessons/${lesson.id}/status`, {
      status: 'DRAFT',
    })
    expect(noConfirm.status).toBe(400)

    const res = await client.patch(`/api/admin/lessons/${lesson.id}/status`, {
      status: 'DRAFT',
      confirm: true,
    })
    expect(res.status).toBe(200)
    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })
    expect(updated).toMatchObject({ status: 'DRAFT', publishedAt: null })

    const log = await prisma.auditLog.findFirstOrThrow({ where: { objectId: lesson.id } })
    expect(log).toMatchObject({ actorId: userId, action: 'status.change', objectType: 'lessons' })

    await client.patch(`/api/admin/lessons/${lesson.id}/status`, {
      status: 'PUBLISHED',
      confirm: true,
    })
  })

  it('rejects unknown kinds and missing ids', async () => {
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    expect(
      (await client.patch('/api/admin/users/x/status', { status: 'DRAFT', confirm: true })).status,
    ).toBe(404)
    expect(
      (await client.patch('/api/admin/lessons/missing/status', { status: 'DRAFT', confirm: true }))
        .status,
    ).toBe(404)
  })

  it('content import keeps admin-chosen status', async () => {
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug: 'testing' } })
    await client.patch(`/api/admin/lessons/${lesson.id}/status`, { status: 'DRAFT', confirm: true })
    const res = await client.post('/api/admin/content/import')
    expect(res.status).toBe(200)
    expect(res.body.data.report.lessons).toBe(12)
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).status).toBe(
      'DRAFT',
    )
    await client.patch(`/api/admin/lessons/${lesson.id}/status`, {
      status: 'PUBLISHED',
      confirm: true,
    })
  })

  it('analytics CSV export is aggregate-only and formula-safe', async () => {
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    await prisma.leadEvent.create({
      data: { event: 'landing_view', utmCampaign: '=HYPERLINK("x")' },
    })
    const res = await client.get('/api/admin/analytics?format=csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('"section","campaign","event","count"')
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`)
    expect(res.text).not.toContain('@example.test')
  })

  it('overview reports checkout disabled and real counts', async () => {
    const { client, userId } = await signedUpClient()
    await makeAdmin(userId)
    const res = await client.get('/api/admin/overview')
    expect(res.body.data.checkoutEnabled).toBe(false)
    expect(res.body.data.totals.paidPurchases).toBe(0)
    expect(res.body.data.funnel.map((f: { event: string }) => f.event)).toContain(
      'purchase_confirmed',
    )
  })
})
