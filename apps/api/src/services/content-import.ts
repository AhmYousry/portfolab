import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
import { CONTENT_STATUSES, slugSchema } from '@pb/shared'
import { prisma } from '../db.js'

const keySchema = z.string().regex(/^[a-z0-9-]+$/)

const projectFileSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  tagline: z.string().default(''),
  description: z.string().min(1),
  level: z.string().min(1),
  tier: z.enum(['FREE', 'PRO']),
  status: z.enum(CONTENT_STATUSES),
  estimatedHours: z.string().min(1),
  order: z.number().int(),
  outcomes: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  modules: z.array(
    z.object({
      key: keySchema,
      title: z.string().min(1),
      description: z.string().default(''),
      order: z.number().int(),
      status: z.enum(CONTENT_STATUSES),
    }),
  ),
})

const lessonFrontmatterSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  order: z.number().int(),
  durationMinutes: z.number().int().positive(),
  isPreview: z.boolean().default(false),
  status: z.enum(CONTENT_STATUSES),
  checkpoints: z
    .array(z.object({ key: keySchema, title: z.string().min(1), instructions: z.string().min(1) }))
    .default([]),
})

const resourcesFileSchema = z.array(
  z.object({
    key: keySchema,
    projectSlug: slugSchema.nullable().default(null),
    title: z.string().min(1),
    description: z.string().default(''),
    type: z.enum(['DOCUMENT', 'PROMPTS', 'CHECKLIST', 'TEMPLATE', 'REPO_ZIP']),
    storageKey: z.string().min(1),
    tier: z.enum(['FREE', 'PRO']),
    status: z.enum(CONTENT_STATUSES),
    order: z.number().int().default(0),
    unlockLesson: z
      .object({ projectSlug: slugSchema, lessonSlug: slugSchema })
      .nullable()
      .default(null),
  }),
)

export interface ImportOptions {
  contentDir: string
  syncStatus: boolean
}

export interface ImportReport {
  projects: number
  modules: number
  lessons: number
  checkpoints: number
  resources: number
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function describe(file: string, error: z.ZodError) {
  const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  return new Error(`Invalid content file ${file}: ${issues}`)
}

export async function importContent({
  contentDir,
  syncStatus,
}: ImportOptions): Promise<ImportReport> {
  const report: ImportReport = { projects: 0, modules: 0, lessons: 0, checkpoints: 0, resources: 0 }
  const projectsDir = path.join(contentDir, 'projects')

  for (const dirName of fs.readdirSync(projectsDir).sort()) {
    const projectFile = path.join(projectsDir, dirName, 'project.json')
    if (!fs.existsSync(projectFile)) continue
    const parsed = projectFileSchema.safeParse(readJson(projectFile))
    if (!parsed.success) throw describe(projectFile, parsed.error)
    const { modules, ...projectData } = parsed.data

    const existingProject = await prisma.project.findUnique({ where: { slug: projectData.slug } })
    const project = await prisma.project.upsert({
      where: { slug: projectData.slug },
      create: projectData,
      update: {
        ...projectData,
        status: syncStatus || !existingProject ? projectData.status : existingProject.status,
      },
    })
    report.projects++

    const lessonSlugs = new Set<string>()
    for (const mod of modules) {
      const existingModule = await prisma.module.findUnique({
        where: { projectId_key: { projectId: project.id, key: mod.key } },
      })
      const moduleRow = await prisma.module.upsert({
        where: { projectId_key: { projectId: project.id, key: mod.key } },
        create: { ...mod, projectId: project.id },
        update: {
          ...mod,
          status: syncStatus || !existingModule ? mod.status : existingModule.status,
        },
      })
      report.modules++

      const moduleDir = path.join(projectsDir, dirName, mod.key)
      if (!fs.existsSync(moduleDir)) continue
      for (const lessonFile of fs
        .readdirSync(moduleDir)
        .filter((f) => f.endsWith('.md'))
        .sort()) {
        const fullPath = path.join(moduleDir, lessonFile)
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'))
        const fm = lessonFrontmatterSchema.safeParse(data)
        if (!fm.success) throw describe(fullPath, fm.error)
        if (lessonSlugs.has(fm.data.slug)) {
          throw new Error(`Duplicate lesson slug "${fm.data.slug}" in project ${project.slug}`)
        }
        lessonSlugs.add(fm.data.slug)

        const { checkpoints, ...lessonData } = fm.data
        const existingLesson = await prisma.lesson.findUnique({
          where: { moduleId_slug: { moduleId: moduleRow.id, slug: lessonData.slug } },
        })
        const status = syncStatus || !existingLesson ? lessonData.status : existingLesson.status
        const lesson = await prisma.lesson.upsert({
          where: { moduleId_slug: { moduleId: moduleRow.id, slug: lessonData.slug } },
          create: {
            ...lessonData,
            moduleId: moduleRow.id,
            contentMarkdown: content.trim(),
            publishedAt: status === 'PUBLISHED' ? new Date() : null,
          },
          update: {
            ...lessonData,
            status,
            contentMarkdown: content.trim(),
            publishedAt:
              status === 'PUBLISHED' ? (existingLesson?.publishedAt ?? new Date()) : null,
          },
        })
        report.lessons++

        const keys = checkpoints.map((c) => c.key)
        await prisma.checkpoint.deleteMany({ where: { lessonId: lesson.id, key: { notIn: keys } } })
        for (const [index, cp] of checkpoints.entries()) {
          await prisma.checkpoint.upsert({
            where: { lessonId_key: { lessonId: lesson.id, key: cp.key } },
            create: { ...cp, lessonId: lesson.id, order: index + 1 },
            update: { ...cp, order: index + 1 },
          })
          report.checkpoints++
        }
      }
    }
  }

  const resourcesFile = path.join(contentDir, 'resources', 'resources.json')
  if (fs.existsSync(resourcesFile)) {
    const parsed = resourcesFileSchema.safeParse(readJson(resourcesFile))
    if (!parsed.success) throw describe(resourcesFile, parsed.error)
    for (const { projectSlug, unlockLesson, ...r } of parsed.data) {
      const project = projectSlug
        ? await prisma.project.findUnique({ where: { slug: projectSlug } })
        : null
      const unlock = unlockLesson
        ? await prisma.lesson.findFirst({
            where: {
              slug: unlockLesson.lessonSlug,
              module: { project: { slug: unlockLesson.projectSlug } },
            },
          })
        : null
      if (unlockLesson && !unlock) throw new Error(`Resource ${r.key}: unlock lesson not found`)
      const existing = await prisma.resource.findUnique({ where: { key: r.key } })
      const data = {
        ...r,
        projectId: project?.id ?? null,
        unlockLessonId: unlock?.id ?? null,
        status: syncStatus || !existing ? r.status : existing.status,
      }
      await prisma.resource.upsert({ where: { key: r.key }, create: data, update: data })
      report.resources++
    }
  }
  return report
}
