import { Router } from 'express'
import { checkpointProgressSchema, idSchema, lessonProgressSchema, slugSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { errors, ok, param, parse, requireUser } from '../http.js'
import { track } from '../services/analytics.js'
import { assertLessonReadable } from '../services/access.js'
import {
  buildLessonView,
  findLessonById,
  findLessonBySlugs,
  lessonInclude,
} from '../services/lessons.js'
import {
  ensureEnrollment,
  projectProgress,
  setLessonProgress,
  syncLessonFromCheckpoints,
} from '../services/progress.js'
import { canAccessTier } from '../services/access.js'

export const studentRouter = Router()

studentRouter.get('/projects/:slug/lessons/:lessonSlug', async (req, res) => {
  const projectSlug = parse(slugSchema, param(req, 'slug'))
  const lessonSlug = parse(slugSchema, param(req, 'lessonSlug'))
  const lesson = await assertLessonReadable(
    await findLessonBySlugs(projectSlug, lessonSlug),
    req.user,
  )
  ok(res, { lesson: await buildLessonView(lesson, req.user?.id) })
})

studentRouter.post('/projects/:slug/enroll', async (req, res) => {
  const user = requireUser(req)
  const slug = parse(slugSchema, param(req, 'slug'))
  const project = await prisma.project.findFirst({ where: { slug, status: 'PUBLISHED' } })
  if (!project) throw errors.notFound('المشروع مش متاح للتسجيل')
  if (!(await canAccessTier(user, project.tier))) {
    throw errors.forbidden('المشروع ده جزء من Portfolio Builder Pro')
  }
  const enrollment = await ensureEnrollment(user.id, project.id)
  ok(res, { enrollment: { projectSlug: slug, createdAt: enrollment.createdAt } }, undefined, 201)
})

studentRouter.put('/lessons/:id/progress', async (req, res) => {
  const user = requireUser(req)
  const id = parse(idSchema, param(req, 'id'))
  const { status } = parse(lessonProgressSchema, req.body)
  const lesson = await assertLessonReadable(await findLessonById(id), user)
  const progress = await setLessonProgress(user.id, lesson.id, lesson.module.projectId, status)
  ok(res, { progress: { lessonId: lesson.id, status: progress.status } })
})

studentRouter.put('/checkpoints/:id/progress', async (req, res) => {
  const user = requireUser(req)
  const id = parse(idSchema, param(req, 'id'))
  const { status } = parse(checkpointProgressSchema, req.body)
  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id },
    include: { lesson: { include: lessonInclude } },
  })
  if (!checkpoint) throw errors.notFound('الـ checkpoint مش موجود')
  const lesson = await assertLessonReadable(checkpoint.lesson, user)

  const before = await prisma.checkpointProgress.findUnique({
    where: { userId_checkpointId: { userId: user.id, checkpointId: id } },
  })
  await prisma.checkpointProgress.upsert({
    where: { userId_checkpointId: { userId: user.id, checkpointId: id } },
    create: { userId: user.id, checkpointId: id, status },
    update: { status },
  })
  if (status === 'COMPLETED' && before?.status !== 'COMPLETED') {
    await track({ event: 'checkpoint_completed', userId: user.id, path: id })
  }
  const lessonProgress = await syncLessonFromCheckpoints(
    user.id,
    lesson.id,
    lesson.module.projectId,
  )
  ok(res, {
    checkpoint: { id, status },
    lesson: { id: lesson.id, status: lessonProgress.status },
  })
})

studentRouter.get('/me/enrollments', async (req, res) => {
  const user = requireUser(req)
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: { project: { select: { slug: true, title: true, tier: true } } },
    orderBy: { createdAt: 'asc' },
  })
  ok(res, {
    enrollments: enrollments.map((e) => ({ project: e.project, createdAt: e.createdAt })),
  })
})

async function enrolledProgress(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, project: { status: 'PUBLISHED' } },
    include: { project: true },
    orderBy: { createdAt: 'asc' },
  })
  return Promise.all(
    enrollments.map(async (e) => ({
      project: {
        slug: e.project.slug,
        title: e.project.title,
        tagline: e.project.tagline,
        tier: e.project.tier,
      },
      ...(await projectProgress(userId, e.project.id)),
    })),
  )
}

studentRouter.get('/me/dashboard', async (req, res) => {
  const user = requireUser(req)
  const projects = await enrolledProgress(user.id)
  const completedCheckpoints = await prisma.checkpointProgress.count({
    where: { userId: user.id, status: 'COMPLETED' },
  })
  ok(res, {
    projects: projects.map(({ lessons: _lessons, ...rest }) => rest),
    stats: { completedCheckpoints },
  })
})

studentRouter.get('/me/progress', async (req, res) => {
  const user = requireUser(req)
  ok(res, { projects: await enrolledProgress(user.id) })
})

studentRouter.get('/me/purchases', async (req, res) => {
  const user = requireUser(req)
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      status: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      paidAt: true,
    },
  })
  ok(res, { purchases })
})
