import { Router } from 'express'
import { analyticsEventSchema, slugSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { errors, ok, param, parse } from '../http.js'
import { analyticsLimiter } from '../security/rate-limit.js'
import { track } from '../services/analytics.js'
import {
  getCurriculum,
  getPricing,
  getProjectDetail,
  listProjects,
  findVisibleProject,
} from '../services/catalog.js'

export const publicRouter = Router()

publicRouter.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    database = 'down'
  }
  res.status(database === 'up' ? 200 : 503).json({
    data: { status: database === 'up' ? 'ok' : 'degraded', database },
    error: null,
  })
})

publicRouter.get('/projects', async (_req, res) => {
  ok(res, { projects: await listProjects() })
})

publicRouter.get('/projects/:slug', async (req, res) => {
  const slug = parse(slugSchema, param(req, 'slug'))
  const project = await getProjectDetail(slug)
  if (!project) throw errors.notFound('المشروع مش موجود')
  ok(res, { project })
})

publicRouter.get('/projects/:slug/curriculum', async (req, res) => {
  const slug = parse(slugSchema, param(req, 'slug'))
  const project = await findVisibleProject(slug)
  if (!project) throw errors.notFound('المشروع مش موجود')
  ok(res, { modules: await getCurriculum(project.id, project.status === 'PUBLISHED') })
})

publicRouter.get('/pricing', async (_req, res) => {
  ok(res, { tiers: await getPricing() })
})

publicRouter.post('/analytics/events', analyticsLimiter, async (req, res) => {
  const input = parse(analyticsEventSchema, req.body)
  await track({
    event: input.event,
    userId: req.user?.id ?? null,
    anonymousId: input.anonymousId ?? null,
    path: input.path ?? null,
    utm: input.utm ?? null,
  })
  res.status(202).json({ data: { accepted: true }, error: null })
})
