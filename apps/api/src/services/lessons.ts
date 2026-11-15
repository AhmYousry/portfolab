import type { LessonView } from '@pb/shared'
import { prisma } from '../db.js'

const NO_USER = '__anonymous__'

export const lessonInclude = { module: { include: { project: true } } } as const

export async function findLessonBySlugs(projectSlug: string, lessonSlug: string) {
  return prisma.lesson.findFirst({
    where: { slug: lessonSlug, module: { project: { slug: projectSlug } } },
    include: lessonInclude,
  })
}

export async function findLessonById(id: string) {
  return prisma.lesson.findUnique({ where: { id }, include: lessonInclude })
}

type FoundLesson = NonNullable<Awaited<ReturnType<typeof findLessonById>>>

export async function buildLessonView(
  lesson: FoundLesson,
  userId: string | undefined,
  opts: { includeUnpublished?: boolean } = {},
): Promise<LessonView> {
  const statusFilter = opts.includeUnpublished ? {} : { status: 'PUBLISHED' as const }
  const siblings = await prisma.lesson.findMany({
    where: {
      ...statusFilter,
      module: { projectId: lesson.module.projectId, ...statusFilter },
    },
    orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    select: { id: true, slug: true, title: true },
  })
  const index = siblings.findIndex((s) => s.id === lesson.id)
  const prev = index > 0 ? siblings[index - 1] : undefined
  const next = index >= 0 ? siblings[index + 1] : undefined

  const checkpoints = await prisma.checkpoint.findMany({
    where: { lessonId: lesson.id },
    orderBy: { order: 'asc' },
    include: { progress: { where: { userId: userId ?? NO_USER }, select: { status: true } } },
  })
  const progress = userId
    ? await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
      })
    : null

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    contentMarkdown: lesson.contentMarkdown,
    durationMinutes: lesson.durationMinutes,
    isPreview: lesson.isPreview,
    module: { id: lesson.module.id, title: lesson.module.title, order: lesson.module.order },
    project: {
      slug: lesson.module.project.slug,
      title: lesson.module.project.title,
      tier: lesson.module.project.tier,
    },
    checkpoints: checkpoints.map((c) => ({
      id: c.id,
      title: c.title,
      instructions: c.instructions,
      order: c.order,
      completed: c.progress.some((p) => p.status === 'COMPLETED'),
    })),
    progressStatus: progress?.status ?? null,
    prev: prev ? { slug: prev.slug, title: prev.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  }
}
