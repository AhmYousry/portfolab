import { Prisma, type ProgressStatus } from '@prisma/client'
import { prisma } from '../db.js'
import { track } from './analytics.js'
import { claimOnce } from './analytics-claims.js'
import { captureForUser } from './product-analytics.js'

const publishedLessonsOf = (projectId: string) => ({
  status: 'PUBLISHED' as const,
  module: { projectId, status: 'PUBLISHED' as const },
})

async function upsertEnrollment(userId: string, projectId: string) {
  const where = { userId_projectId: { userId, projectId } }
  try {
    return await prisma.enrollment.upsert({ where, create: { userId, projectId }, update: {} })
  } catch (error) {
    const raced = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    if (!raced) throw error
    return prisma.enrollment.findUniqueOrThrow({ where })
  }
}

export async function ensureEnrollment(userId: string, projectId: string) {
  const enrollment = await upsertEnrollment(userId, projectId)
  if (!(await claimOnce('project_started', userId, projectId))) return enrollment

  await track({ event: 'project_enrolled', userId, path: projectId })
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { slug: true, tier: true },
  })
  if (project) {
    const event = project.tier === 'FREE' ? 'free_project_started' : 'pro_project_started'
    await captureForUser(userId, event, { project_id: project.slug, source: 'enrollment' })
  }
  return enrollment
}

async function lessonSlugs(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { slug: true, module: { select: { project: { select: { slug: true } } } } },
  })
  return lesson ? { project_id: lesson.module.project.slug, lesson_id: lesson.slug } : null
}

export async function setLessonProgress(
  userId: string,
  lessonId: string,
  projectId: string,
  status: ProgressStatus,
) {
  await ensureEnrollment(userId, projectId)
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status, completedAt: status === 'COMPLETED' ? new Date() : null },
    update: { status, completedAt: status === 'COMPLETED' ? new Date() : null },
  })

  if (status !== 'NOT_STARTED' && (await claimOnce('lesson_started', userId, lessonId))) {
    await track({ event: 'lesson_started', userId, path: lessonId })
    const ids = await lessonSlugs(lessonId)
    if (ids) await captureForUser(userId, 'lesson_started', ids)
  }
  if (status === 'COMPLETED' && (await claimOnce('lesson_completed', userId, lessonId))) {
    const ids = await lessonSlugs(lessonId)
    if (ids) await captureForUser(userId, 'lesson_completed', ids)
  }
  if (status === 'COMPLETED') await checkProjectCompletion(userId, projectId)
  return progress
}

export async function recordCheckpointCompleted(userId: string, checkpointId: string) {
  if (!(await claimOnce('checkpoint_completed', userId, checkpointId))) return false
  await track({ event: 'checkpoint_completed', userId, path: checkpointId })
  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
    select: {
      key: true,
      lesson: {
        select: { slug: true, module: { select: { project: { select: { slug: true } } } } },
      },
    },
  })
  if (checkpoint) {
    await captureForUser(userId, 'checkpoint_completed', {
      project_id: checkpoint.lesson.module.project.slug,
      lesson_id: checkpoint.lesson.slug,
      checkpoint_id: checkpoint.key,
    })
  }
  return true
}

export async function syncLessonFromCheckpoints(
  userId: string,
  lessonId: string,
  projectId: string,
) {
  const checkpoints = await prisma.checkpoint.findMany({
    where: { lessonId },
    select: { id: true },
  })
  const done = await prisma.checkpointProgress.count({
    where: { userId, status: 'COMPLETED', checkpointId: { in: checkpoints.map((c) => c.id) } },
  })
  const status: ProgressStatus =
    checkpoints.length > 0 && done === checkpoints.length ? 'COMPLETED' : 'IN_PROGRESS'
  return setLessonProgress(userId, lessonId, projectId, status)
}

async function checkProjectCompletion(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return
  const total = await prisma.lesson.count({ where: publishedLessonsOf(projectId) })
  const completed = await prisma.lessonProgress.count({
    where: { userId, status: 'COMPLETED', lesson: publishedLessonsOf(projectId) },
  })
  if (total === 0 || completed !== total) return
  if (!(await claimOnce('project_completed', userId, projectId))) return
  const plan = project.tier === 'FREE' ? 'free' : 'pro'
  await track({
    event: project.tier === 'FREE' ? 'free_project_completed' : 'pro_project_completed',
    userId,
    path: project.slug,
  })
  await captureForUser(userId, 'project_completed', { project_id: project.slug, plan })
}
export async function projectProgress(userId: string, projectId: string) {
  const lessons = await prisma.lesson.findMany({
    where: publishedLessonsOf(projectId),
    orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      module: { select: { title: true, order: true } },
      progress: { where: { userId }, select: { status: true } },
    },
  })
  const completed = lessons.filter((l) => l.progress[0]?.status === 'COMPLETED').length
  const next = lessons.find((l) => l.progress[0]?.status !== 'COMPLETED') ?? null
  return {
    totalLessons: lessons.length,
    completedLessons: completed,
    percent: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
    nextLesson: next
      ? { slug: next.slug, title: next.title, moduleTitle: next.module.title }
      : null,
    lessons: lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      moduleTitle: l.module.title,
      moduleOrder: l.module.order,
      status: l.progress[0]?.status ?? 'NOT_STARTED',
    })),
  }
}
