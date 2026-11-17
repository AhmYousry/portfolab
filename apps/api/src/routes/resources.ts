import fs from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'
import { Router } from 'express'
import { idSchema, type ResourceView } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { errors, ok, param, parse, requireUser } from '../http.js'
import { resourceAccess } from '../services/access.js'
import { captureForUser } from '../services/product-analytics.js'

const ZIP_SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git'])
const ENV_FILE = /^\.env(\..+)?$/
const ENV_EXAMPLE = '.env.example'

export function listZipFiles(root: string, dir = root): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ZIP_SKIP_DIRS.has(entry.name)) files.push(...listZipFiles(root, full))
      continue
    }
    if (!entry.isFile()) continue
    if (ENV_FILE.test(entry.name) && entry.name !== ENV_EXAMPLE) continue
    if (entry.name.endsWith('.log')) continue
    files.push(path.relative(root, full))
  }
  return files
}
const LOCK_REASONS = {
  TIER: 'متاح في Portfolab Pro',
  UNLOCK: 'بيتفتح بعد ما تخلص الـ checkpoints بتاعة الدرس المطلوب',
} as const

export const resourcesRouter = Router()

function safeResolve(base: string, relative: string): string {
  const resolved = path.resolve(base, relative)
  const rel = path.relative(base, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw errors.notFound()
  return resolved
}

resourcesRouter.get('/resources', async (req, res) => {
  const user = requireUser(req)
  const resources = await prisma.resource.findMany({
    where: { status: 'PUBLISHED' },
    include: { project: { select: { slug: true } } },
    orderBy: [{ order: 'asc' }],
  })
  const views: ResourceView[] = await Promise.all(
    resources.map(async (r) => {
      const access = await resourceAccess(r, user)
      return {
        id: r.id,
        key: r.key,
        title: r.title,
        description: r.description,
        type: r.type,
        tier: r.tier,
        projectSlug: r.project?.slug ?? null,
        locked: !access.allowed,
        lockReason: access.reason ? LOCK_REASONS[access.reason] : null,
      }
    }),
  )
  ok(res, { resources: views })
})

resourcesRouter.get('/resources/:id/download', async (req, res) => {
  const user = requireUser(req)
  const id = parse(idSchema, param(req, 'id'))
  const resource = await prisma.resource.findUnique({ where: { id } })
  if (!resource || resource.status !== 'PUBLISHED') throw errors.notFound('الملف مش موجود')

  const access = await resourceAccess(resource, user)
  if (!access.allowed) throw errors.forbidden(LOCK_REASONS[access.reason ?? 'TIER'])

  const project = resource.projectId
    ? await prisma.project.findUnique({ where: { id: resource.projectId }, select: { slug: true } })
    : null
  await captureForUser(user.id, 'resource_downloaded', {
    resource_id: resource.key,
    project_id: project?.slug,
    plan: resource.tier === 'PRO' ? 'pro' : 'free',
  })

  const repoRoot = path.resolve(env.contentDir, '..')
  res.setHeader('Cache-Control', 'private, no-store')

  if (resource.type === 'REPO_ZIP') {
    const dir = safeResolve(repoRoot, resource.storageKey)
    if (!fs.existsSync(dir)) throw errors.notFound('الملف مش موجود')
    res.attachment(`${resource.key}.zip`)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', () => res.destroy())
    archive.pipe(res)
    for (const file of listZipFiles(dir)) {
      archive.file(path.join(dir, file), {
        name: `${resource.key}/${file.split(path.sep).join('/')}`,
      })
    }
    await archive.finalize()
    return
  }

  const file = safeResolve(path.join(env.contentDir, 'resources'), resource.storageKey)
  if (!fs.existsSync(file)) throw errors.notFound('الملف مش موجود')
  res.attachment(path.basename(file))
  res.type(
    path.extname(file) === '.md' ? 'text/markdown; charset=utf-8' : 'application/octet-stream',
  )
  fs.createReadStream(file).pipe(res)
})
