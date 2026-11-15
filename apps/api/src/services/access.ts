import type { Lesson, Module, Project, Resource, Tier } from '@prisma/client'
import { prisma } from '../db.js'
import { errors } from '../http.js'
import { hasActivePro } from './users.js'

export interface Viewer {
  id: string
  role: 'STUDENT' | 'ADMIN'
}

export async function canAccessTier(viewer: Viewer | undefined, tier: Tier): Promise<boolean> {
  if (tier === 'FREE') return true
  if (!viewer) return false
  if (viewer.role === 'ADMIN') return true
  return hasActivePro(viewer.id)
}

type LessonWithParents = Lesson & { module: Module & { project: Project } }

export function isLessonPublic(lesson: LessonWithParents): boolean {
  return (
    lesson.status === 'PUBLISHED' &&
    lesson.module.status === 'PUBLISHED' &&
    lesson.module.project.status === 'PUBLISHED'
  )
}

export async function assertLessonReadable(
  lesson: LessonWithParents | null,
  viewer: Viewer | undefined,
): Promise<LessonWithParents> {
  if (!lesson || !isLessonPublic(lesson)) throw errors.notFound('الدرس مش موجود')

  const { tier } = lesson.module.project
  if (tier === 'FREE' && lesson.isPreview) return lesson
  if (!viewer) throw errors.unauthorized('سجل دخول مجانًا عشان تكمل الدرس')
  if (!(await canAccessTier(viewer, tier))) {
    throw errors.forbidden('الدرس ده جزء من Portfolab Pro')
  }
  return lesson
}

export async function lessonCheckpointsComplete(userId: string, lessonId: string) {
  const checkpoints = await prisma.checkpoint.findMany({
    where: { lessonId },
    select: { id: true },
  })
  if (checkpoints.length === 0) {
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    })
    return progress?.status === 'COMPLETED'
  }
  const done = await prisma.checkpointProgress.count({
    where: { userId, status: 'COMPLETED', checkpointId: { in: checkpoints.map((c) => c.id) } },
  })
  return done === checkpoints.length
}

export interface ResourceAccess {
  allowed: boolean
  reason: 'TIER' | 'UNLOCK' | null
}

export async function resourceAccess(
  resource: Resource,
  viewer: Viewer | undefined,
): Promise<ResourceAccess> {
  if (!viewer) return { allowed: false, reason: 'TIER' }
  if (!(await canAccessTier(viewer, resource.tier))) return { allowed: false, reason: 'TIER' }
  if (viewer.role === 'ADMIN' || !resource.unlockLessonId) return { allowed: true, reason: null }
  const unlocked = await lessonCheckpointsComplete(viewer.id, resource.unlockLessonId)
  return unlocked ? { allowed: true, reason: null } : { allowed: false, reason: 'UNLOCK' }
}
