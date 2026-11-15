import { Router, type Request } from 'express'
import type { Prisma } from '@prisma/client'
import { ANALYTICS_EVENTS, adminSetStatusSchema, idSchema, paginationSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { errors, ok, param, parse, requireAdmin } from '../http.js'
import { importContent } from '../services/content-import.js'
import { buildLessonView, findLessonById } from '../services/lessons.js'

export const adminRouter = Router()

adminRouter.use((req, _res, next) => {
  requireAdmin(req)
  next()
})

async function audit(
  req: Request,
  action: string,
  objectType: string,
  objectId: string,
  detail?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({
    data: {
      actorId: req.user?.id ?? null,
      action,
      objectType,
      objectId,
      detail: detail ?? undefined,
    },
  })
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

async function funnel() {
  const grouped = await prisma.leadEvent.groupBy({ by: ['event'], _count: { _all: true } })
  const counts = new Map(grouped.map((g) => [g.event, g._count._all]))
  return ANALYTICS_EVENTS.map((event) => ({ event, count: counts.get(event) ?? 0 }))
}

adminRouter.get('/overview', async (_req, res) => {
  const [users, enrollments, lessonsCompleted, checkpointsCompleted, purchases] = await Promise.all(
    [
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.enrollment.count(),
      prisma.lessonProgress.count({ where: { status: 'COMPLETED' } }),
      prisma.checkpointProgress.count({ where: { status: 'COMPLETED' } }),
      prisma.purchase.count({ where: { status: 'PAID' } }),
    ],
  )
  ok(res, {
    totals: {
      users,
      enrollments,
      lessonsCompleted,
      checkpointsCompleted,
      paidPurchases: purchases,
    },
    funnel: await funnel(),
    checkoutEnabled: false,
  })
})

adminRouter.get('/projects', async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { order: 'asc' },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              isPreview: true,
              order: true,
            },
          },
        },
      },
    },
  })
  ok(res, { projects })
})

const statusTargets = {
  projects: (id: string, status: Prisma.ProjectUpdateInput['status']) =>
    prisma.project.update({ where: { id }, data: { status } }),
  modules: (id: string, status: Prisma.ModuleUpdateInput['status']) =>
    prisma.module.update({ where: { id }, data: { status } }),
  lessons: async (id: string, status: Prisma.LessonUpdateInput['status']) => {
    const current = await prisma.lesson.findUniqueOrThrow({ where: { id } })
    return prisma.lesson.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? (current.publishedAt ?? new Date()) : null,
      },
    })
  },
  resources: (id: string, status: Prisma.ResourceUpdateInput['status']) =>
    prisma.resource.update({ where: { id }, data: { status } }),
} as const

type StatusTarget = keyof typeof statusTargets

function isStatusTarget(value: string): value is StatusTarget {
  return value in statusTargets
}

adminRouter.patch('/:kind/:id/status', async (req, res) => {
  const kind = param(req, 'kind')
  if (!isStatusTarget(kind)) throw errors.notFound()
  const id = parse(idSchema, param(req, 'id'))
  const { status } = parse(adminSetStatusSchema, req.body)
  try {
    await statusTargets[kind](id, status)
  } catch {
    throw errors.notFound()
  }
  await audit(req, 'status.change', kind, id, { status })
  ok(res, { id, kind, status })
})

adminRouter.get('/lessons/:id/preview', async (req, res) => {
  const id = parse(idSchema, param(req, 'id'))
  const lesson = await findLessonById(id)
  if (!lesson) throw errors.notFound()
  ok(res, { lesson: await buildLessonView(lesson, undefined, { includeUnpublished: true }) })
})

adminRouter.post('/content/import', async (req, res) => {
  const report = await importContent({ contentDir: env.contentDir, syncStatus: false })
  await audit(req, 'content.import', 'content', 'all', { ...report })
  ok(res, { report })
})

adminRouter.get('/users', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query)
  const where = { deletedAt: null }
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
        _count: {
          select: { enrollments: true, lessonProgress: { where: { status: 'COMPLETED' } } },
        },
      },
    }),
  ])
  ok(
    res,
    {
      users: users.map((u) => ({
        id: u.id,
        email: maskEmail(u.email),
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        enrollments: u._count.enrollments,
        lessonsCompleted: u._count.lessonProgress,
      })),
    },
    { page, pageSize, total },
  )
})

adminRouter.get('/orders', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query)
  const [total, purchases, activeEntitlements] = await Promise.all([
    prisma.purchase.count(),
    prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        provider: true,
        status: true,
        amountMinor: true,
        currency: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.entitlement.count({ where: { revokedAt: null } }),
  ])
  ok(res, { purchases, activeEntitlements, checkoutEnabled: false }, { page, pageSize, total })
})

function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

adminRouter.get('/analytics', async (req, res) => {
  const events = await funnel()
  const campaigns = await prisma.leadEvent.groupBy({
    by: ['utmCampaign', 'event'],
    where: { utmCampaign: { not: null } },
    _count: { _all: true },
    orderBy: { utmCampaign: 'asc' },
  })
  const byCampaign = campaigns.map((c) => ({
    campaign: c.utmCampaign ?? '',
    event: c.event,
    count: c._count._all,
  }))

  if (req.query.format === 'csv') {
    const rows = [
      ['section', 'campaign', 'event', 'count'],
      ...events.map((e) => ['funnel', '', e.event, e.count]),
      ...byCampaign.map((c) => ['campaign', c.campaign, c.event, c.count]),
    ]
    await audit(req, 'analytics.export', 'analytics', 'csv')
    res.setHeader('Cache-Control', 'private, no-store')
    res.attachment('funnel-metrics.csv')
    res.type('text/csv; charset=utf-8')
    res.send(rows.map((r) => r.map(csvCell).join(',')).join('\n'))
    return
  }
  ok(res, { funnel: events, byCampaign })
})

adminRouter.get('/audit-log', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query)
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { actor: { select: { displayName: true } } },
  })
  ok(res, {
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      objectType: e.objectType,
      objectId: e.objectId,
      detail: e.detail,
      actor: e.actor?.displayName ?? null,
      createdAt: e.createdAt,
    })),
  })
})
