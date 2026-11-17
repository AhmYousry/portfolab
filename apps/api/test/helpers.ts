import request from 'supertest'
import type { Tier } from '@prisma/client'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'
import { importContent } from '../src/services/content-import.js'

export const app = createApp()
export const ORIGIN = 'http://localhost:5173'
export const PASSWORD = 'correct-horse-battery'

const TABLES = [
  'AnalyticsClaim',
  'AuditLog',
  'LeadEvent',
  'WebhookEvent',
  'Entitlement',
  'Purchase',
  'CheckpointProgress',
  'LessonProgress',
  'Enrollment',
  'Resource',
  'Checkpoint',
  'Lesson',
  'Module',
  'Project',
  'PasswordResetToken',
  'Session',
  'User',
]

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export async function seedContent() {
  await importContent({ contentDir: env.contentDir, syncStatus: true })
}

export class Client {
  agent = request.agent(app)
  csrf = ''

  async init() {
    const res = await this.agent.get('/api/auth/csrf')
    this.csrf = res.body.data.csrfToken
    return this
  }

  get(path: string) {
    return this.agent.get(path)
  }

  private mutate(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: object) {
    const req = this.agent[method](path).set('X-CSRF-Token', this.csrf).set('Origin', ORIGIN)
    return body ? req.send(body) : req
  }

  post(path: string, body?: object) {
    return this.mutate('post', path, body)
  }

  put(path: string, body?: object) {
    return this.mutate('put', path, body)
  }

  patch(path: string, body?: object) {
    return this.mutate('patch', path, body)
  }
}

let counter = 0

export async function signedUpClient(overrides: { email?: string } = {}) {
  counter += 1
  const client = await new Client().init()
  const email = overrides.email ?? `student${counter}@example.test`
  const res = await client.post('/api/auth/signup', {
    email,
    password: PASSWORD,
    displayName: `Student ${counter}`,
    acceptPrivacy: true,
  })
  if (res.status !== 201)
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { client, email, userId: res.body.data.user.id as string }
}

export async function makeAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } })
}

export async function grantEntitlement(userId: string, tier: Tier = 'PRO') {
  await prisma.entitlement.create({ data: { userId, tier } })
}

export async function createPublishedProProject() {
  const project = await prisma.project.create({
    data: {
      slug: 'pro-fixture',
      title: 'Pro fixture',
      description: 'Test-only paid project',
      level: 'Junior',
      tier: 'PRO',
      status: 'PUBLISHED',
      estimatedHours: '1',
      order: 99,
      modules: {
        create: {
          key: 'm1',
          title: 'Module 1',
          order: 1,
          status: 'PUBLISHED',
          lessons: {
            create: [
              {
                slug: 'paid-lesson',
                title: 'Paid lesson',
                contentMarkdown: 'SECRET PRO CONTENT',
                order: 1,
                durationMinutes: 10,
                status: 'PUBLISHED',
                checkpoints: {
                  create: { key: 'c1', title: 'cp', instructions: 'do it', order: 1 },
                },
              },
              {
                slug: 'paid-preview',
                title: 'Paid preview flag',
                contentMarkdown: 'ALSO SECRET',
                order: 2,
                durationMinutes: 10,
                isPreview: true,
                status: 'PUBLISHED',
              },
            ],
          },
        },
      },
      resources: {
        create: {
          key: 'pro-resource',
          title: 'Pro resource',
          type: 'DOCUMENT',
          storageKey: 'taskflow-lite/project-brief.md',
          tier: 'PRO',
          status: 'PUBLISHED',
        },
      },
    },
    include: {
      modules: { include: { lessons: { include: { checkpoints: true } } } },
      resources: true,
    },
  })
  return project
}

export async function lessonBySlug(projectSlug: string, lessonSlug: string) {
  return prisma.lesson.findFirstOrThrow({
    where: { slug: lessonSlug, module: { project: { slug: projectSlug } } },
    include: { checkpoints: { orderBy: { order: 'asc' } } },
  })
}
