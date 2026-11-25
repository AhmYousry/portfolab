import { Router } from 'express'
import { analyticsConsentSchema, deleteAccountSchema, updateProfileSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { errors, ok, parse, requireUser } from '../http.js'
import { authLimiter } from '../security/rate-limit.js'
import { verifyPassword } from '../security/password.js'
import { clearSessionCookie } from '../security/session.js'
import {
  clearReauthCookie,
  deleteWithGrant,
  deleteWithPassword,
  readReauthCookie,
  reauthRequired,
} from '../services/account-deletion.js'
import { passwordAuthEnabled } from '../services/auth-mode.js'
import { toPublicUser } from '../services/users.js'

export const accountRouter = Router()

accountRouter.patch('/me/profile', async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(updateProfileSchema, req.body)
  const user = await prisma.user.update({ where: { id: viewer.id }, data: input })
  ok(res, { user: await toPublicUser(user) })
})

accountRouter.put('/me/analytics-consent', async (req, res) => {
  const viewer = requireUser(req)
  const { analytics } = parse(analyticsConsentSchema, req.body)
  await prisma.user.update({
    where: { id: viewer.id },
    data: { analyticsConsent: analytics, analyticsConsentAt: new Date() },
  })
  ok(res, { analyticsConsent: analytics })
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
      analyticsConsent: true,
      analyticsConsentAt: true,
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
      oauthIdentities: {
        select: { provider: true, subject: true, createdAt: true, lastLoginAt: true },
      },
    },
  })
  res.setHeader('Cache-Control', 'private, no-store')
  res.attachment('portfolio-builder-my-data.json')
  res.json({ data: { exportedAt: new Date().toISOString(), user }, error: null })
})

// Two proofs are accepted: the account password (password mode only), or a fresh single-use
// provider re-authentication grant bound to this exact session (HttpOnly cookie).
accountRouter.post('/me/delete', authLimiter, async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(deleteAccountSchema, req.body)

  if (input.password !== undefined) {
    if (!passwordAuthEnabled()) throw errors.passwordAuthDisabled()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw errors.badRequest('كلمة المرور غلط')
    }
    await deleteWithPassword(user.id)
  } else {
    const token = readReauthCookie(req)
    clearReauthCookie(res)
    if (!token) throw reauthRequired()
    await deleteWithGrant({ userId: viewer.id, sessionId: viewer.sessionId, token })
  }

  clearSessionCookie(res)
  ok(res, { deleted: true })
})
