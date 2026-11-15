import type { Prisma } from '@prisma/client'
import type { CurriculumModule, PricingTier, ProjectDetail, ProjectSummary } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'

const PRO_TEST_PRICE_MINOR = 24900
const CHECKOUT_IMPLEMENTED: boolean = false
const VISIBLE_PROJECT_STATUSES = ['PUBLISHED', 'COMING_SOON'] as const

const publishedLessonFilter = {
  status: 'PUBLISHED',
  module: { status: 'PUBLISHED', project: { status: 'PUBLISHED' } },
} satisfies Prisma.LessonWhereInput

type ProjectRow = Prisma.ProjectGetPayload<object>

async function lessonCount(projectId: string) {
  return prisma.lesson.count({
    where: { ...publishedLessonFilter, module: { ...publishedLessonFilter.module, projectId } },
  })
}

async function toSummary(p: ProjectRow): Promise<ProjectSummary> {
  return {
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    level: p.level,
    tier: p.tier,
    status: p.status,
    estimatedHours: p.estimatedHours,
    order: p.order,
    lessonCount: await lessonCount(p.id),
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: [...VISIBLE_PROJECT_STATUSES] } },
    orderBy: { order: 'asc' },
  })
  return Promise.all(projects.map(toSummary))
}

export async function findVisibleProject(slug: string) {
  return prisma.project.findFirst({
    where: { slug, status: { in: [...VISIBLE_PROJECT_STATUSES] } },
  })
}

export async function getCurriculum(
  projectId: string,
  projectPublished: boolean,
): Promise<CurriculumModule[]> {
  const modules = await prisma.module.findMany({
    where: { projectId, status: { in: [...VISIBLE_PROJECT_STATUSES] } },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        where: { status: 'PUBLISHED' },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          order: true,
          durationMinutes: true,
          isPreview: true,
          _count: { select: { checkpoints: true } },
        },
      },
    },
  })
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    lessons:
      projectPublished && m.status === 'PUBLISHED'
        ? m.lessons.map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            order: l.order,
            durationMinutes: l.durationMinutes,
            isPreview: l.isPreview,
            checkpointCount: l._count.checkpoints,
          }))
        : [],
  }))
}

export async function getProjectDetail(slug: string): Promise<ProjectDetail | null> {
  const project = await findVisibleProject(slug)
  if (!project) return null
  return {
    ...(await toSummary(project)),
    outcomes: project.outcomes,
    skills: project.skills,
    modules: await getCurriculum(project.id, project.status === 'PUBLISHED'),
  }
}

export async function getPricing(): Promise<PricingTier[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: [...VISIBLE_PROJECT_STATUSES] } },
    orderBy: { order: 'asc' },
    select: { slug: true, title: true, status: true, tier: true },
  })
  const free = projects.filter((p) => p.tier === 'FREE')
  const pro = projects.filter((p) => p.tier === 'PRO')
  const proAvailable = pro.some((p) => p.status === 'PUBLISHED')
  const strip = ({ slug, title, status }: (typeof projects)[number]) => ({ slug, title, status })

  return [
    {
      id: 'FREE',
      name: 'Portfolio Starter',
      priceMinor: 0,
      currency: 'EGP',
      isTestPrice: false,
      available: free.some((p) => p.status === 'PUBLISHED'),
      checkoutEnabled: false,
      includes: [
        'مشروع TaskFlow Lite كامل: React + Express + PostgreSQL',
        '6 موديولز بخطوات عملية وcheckpoints',
        '10 AI prompts عملية (F01–F10)',
        'Starter repo + reference solution بعد الـ checkpoints',
        'Tests أساسية + دليل deployment + README template',
      ],
      projects: free.map(strip),
    },
    {
      id: 'PRO',
      name: 'Portfolio Builder Pro',
      priceMinor: PRO_TEST_PRICE_MINOR,
      currency: 'EGP',
      isTestPrice: true,
      available: proAvailable,
      checkoutEnabled: CHECKOUT_IMPLEMENTED && env.CHECKOUT_ENABLED && proAvailable,
      includes: [
        '3 مشاريع أعمق: ExpensePilot، TeamBoard، IssueForge (بتنزل واحد واحد)',
        'Auth، RBAC، multi-tenant authorization، audit logs',
        '40+ prompts مخصصة للمشاريع (مخطط)',
        'Integration + security tests متقدمة',
        'Interview pack لكل مشروع',
      ],
      projects: pro.map(strip),
    },
  ]
}
