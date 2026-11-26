import { Prisma, type User } from '@prisma/client'
import { type NextFunction, type Request, type Response, Router } from 'express'
import { type NeonErrorCode, neonSessionSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { HttpError, ok, parse } from '../http.js'
import { authLimiter } from '../security/rate-limit.js'
import { createSession } from '../security/session.js'
import { randomToken } from '../security/tokens.js'
import { track } from '../services/analytics.js'
import { neonAuthEnabled } from '../services/auth-mode.js'
import {
  type NeonClaims,
  NeonAuthFailure,
  neonAuthConfig,
  verifyNeonProof,
} from '../services/neon-auth.js'
import { toPublicUser } from '../services/users.js'

const DISABLED_PASSWORD_PREFIX = '!neon-managed-'

const FAILURES: Record<NeonErrorCode, { status: number; message: string }> = {
  NEON_AUTH_DISABLED: { status: 404, message: 'الطريقة دي مش متاحة' },
  NEON_TOKEN_INVALID: { status: 401, message: 'مقدرناش نتأكد من تسجيل الدخول. ادخل تاني.' },
  NEON_SESSION_INVALID: { status: 401, message: 'الجلسة انتهت أو اتقفلت. ادخل تاني.' },
  EMAIL_UNVERIFIED: { status: 403, message: 'لازم تأكد إيميلك الأول.' },
  EMAIL_IN_USE: {
    status: 409,
    message: 'الإيميل ده مربوط بحساب قديم عندنا. تواصل معانا عشان نساعدك تنقله.',
  },
  SIGNUP_REQUIRED: { status: 403, message: 'لازم توافق على سياسة الخصوصية عشان نكمل حسابك.' },
  ACCOUNT_UNAVAILABLE: { status: 403, message: 'الحساب ده مش متاح.' },
}

export function neonFailure(code: NeonErrorCode) {
  const { status, message } = FAILURES[code]
  return new HttpError(status, code, message)
}

export function toNeonHttpError(err: unknown): unknown {
  return err instanceof NeonAuthFailure ? neonFailure(err.code) : err
}

export function requireNeonAuth(_req: Request, _res: Response, next: NextFunction) {
  if (!neonAuthEnabled() || !neonAuthConfig()) return next(neonFailure('NEON_AUTH_DISABLED'))
  next()
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

function findIdentity(subject: string) {
  return prisma.neonAuthIdentity.findUnique({ where: { subject }, include: { user: true } })
}

type IdentityWithUser = NonNullable<Awaited<ReturnType<typeof findIdentity>>>

async function existingLogin(identity: IdentityWithUser) {
  if (identity.user.deletedAt) throw neonFailure('ACCOUNT_UNAVAILABLE')
  await prisma.neonAuthIdentity.update({
    where: { id: identity.id },
    data: { lastLoginAt: new Date() },
  })
  return { user: identity.user, created: false }
}

// Identity is the verified subject only. An existing local email is never linked, and existing
// local passwords are never touched.
async function resolveUser(
  claims: NeonClaims,
  acceptPrivacy: boolean,
): Promise<{ user: User; created: boolean }> {
  const identity = await findIdentity(claims.subject)
  if (identity) return existingLogin(identity)

  if (!claims.email) throw neonFailure('NEON_TOKEN_INVALID')
  const collision = await prisma.user.findUnique({
    where: { email: claims.email },
    select: { id: true },
  })
  if (collision) throw neonFailure('EMAIL_IN_USE')
  if (!acceptPrivacy) throw neonFailure('SIGNUP_REQUIRED')

  const now = new Date()
  try {
    const user = await prisma.user.create({
      data: {
        email: claims.email,
        passwordHash: `${DISABLED_PASSWORD_PREFIX}${randomToken()}`,
        displayName: claims.displayName,
        privacyAcceptedAt: now,
        neonIdentity: { create: { subject: claims.subject, lastLoginAt: now } },
      },
    })
    return { user, created: true }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const raced = await findIdentity(claims.subject)
    if (!raced) throw neonFailure('EMAIL_IN_USE')
    return existingLogin(raced)
  }
}

export const neonAuthRouter = Router()

// Bridges a verified Neon Auth session into a local API session bound to it.
neonAuthRouter.post('/session', requireNeonAuth, authLimiter, async (req, res) => {
  const input = parse(neonSessionSchema, req.body)
  const config = neonAuthConfig()
  if (!config) throw neonFailure('NEON_AUTH_DISABLED')

  let verified: Awaited<ReturnType<typeof verifyNeonProof>>
  try {
    verified = await verifyNeonProof(input)
  } catch (err) {
    throw toNeonHttpError(err)
  }
  const { claims, session } = verified
  if (config.requireEmailVerified && !claims.emailVerified) throw neonFailure('EMAIL_UNVERIFIED')

  const acceptPrivacy = input.intent === 'signup' && input.acceptPrivacy === true
  const { user, created } = await resolveUser(claims, acceptPrivacy)

  if (req.user) {
    await prisma.session.updateMany({
      where: { id: req.user.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  await createSession(req, res, user.id, {
    neonSessionId: input.sessionId,
    notAfter: session.expiresAt,
  })
  if (created) await track({ event: 'signup_complete', userId: user.id, utm: input.utm ?? null })
  res.setHeader('Cache-Control', 'no-store')
  ok(res, { user: await toPublicUser(user), created }, undefined, created ? 201 : 200)
})
