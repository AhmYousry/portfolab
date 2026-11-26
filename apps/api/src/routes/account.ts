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
  deleteWithNeonProof,
  deleteWithPassword,
  neonReauthRequired,
  readReauthCookie,
  reauthRequired,
} from '../services/account-deletion.js'
import { neonAuthEnabled, passwordAuthEnabled } from '../services/auth-mode.js'
import { verifyNeonProof } from '../services/neon-auth.js'
import { toPublicUser } from '../services/users.js'
import { toNeonHttpError } from './neon-auth.js'

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
      neonIdentity: { select: { subject: true, createdAt: true, lastLoginAt: true } },
    },
  })
  res.setHeader('Cache-Control', 'private, no-store')
  res.attachment('portfolio-builder-my-data.json')
  res.json({ data: { exportedAt: new Date().toISOString(), user }, error: null })
})

// Proofs accepted: the account password (password mode only); a fresh single-use provider
// re-authentication grant bound to this exact session (social mode, HttpOnly cookie); or, in neon
// mode only, a verified Neon session created by a fresh sign-in.
accountRouter.post('/me/delete', authLimiter, async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(deleteAccountSchema, req.body)

  if (neonAuthEnabled()) {
    clearReauthCookie(res)
    if (!input.neonProof || input.password !== undefined) throw neonReauthRequired()
    let verified: Awaited<ReturnType<typeof verifyNeonProof>>
    try {
      verified = await verifyNeonProof(input.neonProof)
    } catch (err) {
      throw toNeonHttpError(err)
    }
    await deleteWithNeonProof({
      userId: viewer.id,
      sessionId: viewer.sessionId,
      subject: verified.claims.subject,
      upstreamCreatedAt: verified.session.createdAt,
    })
  } else if (input.neonProof !== undefined) {
    throw errors.badRequest()
  } else if (input.password !== undefined) {
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
