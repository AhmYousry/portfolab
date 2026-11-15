import type { ProgressStatus } from '@prisma/client'
import { prisma } from '../db.js'
import { track, trackOnce } from './analytics.js'

const publishedLessonsOf = (projectId: string) => ({
  status: 'PUBLISHED' as const,
  module: { projectId, status: 'PUBLISHED' as const },
})

export async function ensureEnrollment(userId: string, projectId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (existing) return existing
  const created = await prisma.enrollment.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  })
  await track({ event: 'project_enrolled', userId, path: projectId })
  return created
}

export async function setLessonProgress(
  userId: string,
  lessonId: string,
  projectId: string,
  status: ProgressStatus,
) {
  await ensureEnrollment(userId, projectId)
  const before = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  })
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status, completedAt: status === 'COMPLETED' ? new Date() : null },
    update: { status, completedAt: status === 'COMPLETED' ? new Date() : null },
  })
  if (!before && status !== 'NOT_STARTED') {
    await track({ event: 'lesson_started', userId, path: lessonId })
  }
  if (status === 'COMPLETED') await checkProjectCompletion(userId, projectId)
  return progress
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
  if (total > 0 && completed === total && project.tier === 'FREE') {
    await trackOnce({ event: 'free_project_completed', userId, path: project.slug })
  }
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
