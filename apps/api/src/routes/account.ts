import { Router } from 'express'
import { deleteAccountSchema, updateProfileSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { errors, ok, parse, requireUser } from '../http.js'
import { authLimiter } from '../security/rate-limit.js'
import { verifyPassword } from '../security/password.js'
import { clearSessionCookie, revokeAllSessions } from '../security/session.js'
import { randomToken } from '../security/tokens.js'
import { toPublicUser } from '../services/users.js'

export const accountRouter = Router()

accountRouter.patch('/me/profile', async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(updateProfileSchema, req.body)
  const user = await prisma.user.update({ where: { id: viewer.id }, data: input })
  ok(res, { user: await toPublicUser(user) })
})

accountRouter.get('/me/export', async (req, res) => {
  const viewer = requireUser(req)
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: viewer.id },
    select: {
      email: true,
      displayName: true,
      locale: true,
      experienceLevel: true,
      weeklyHours: true,
      goal: true,
      githubUrl: true,
      privacyAcceptedAt: true,
      createdAt: true,
      enrollments: { select: { createdAt: true, project: { select: { slug: true } } } },
      lessonProgress: {
        select: { status: true, completedAt: true, lesson: { select: { slug: true } } },
      },
      checkpointProgress: {
        select: { status: true, updatedAt: true, checkpoint: { select: { key: true } } },
      },
      purchases: {
        select: {
          provider: true,
          status: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
        },
      },
      entitlements: { select: { tier: true, grantedAt: true, revokedAt: true } },
      sessions: { select: { createdAt: true, expiresAt: true, revokedAt: true, userAgent: true } },
    },
  })
  res.setHeader('Cache-Control', 'private, no-store')
  res.attachment('portfolio-builder-my-data.json')
  res.json({ data: { exportedAt: new Date().toISOString(), user }, error: null })
})

accountRouter.post('/me/delete', authLimiter, async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(deleteAccountSchema, req.body)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw errors.badRequest('كلمة المرور غلط')
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@deleted.invalid`,
        displayName: 'Deleted user',
        passwordHash: `!disabled-${randomToken()}`,
        githubUrl: null,
        experienceLevel: null,
        weeklyHours: null,
        goal: null,
        deletedAt: new Date(),
      },
    }),
    prisma.leadEvent.updateMany({ where: { userId: user.id }, data: { userId: null } }),
  ])
  await revokeAllSessions(user.id)
  clearSessionCookie(res)
  ok(res, { deleted: true })
})
