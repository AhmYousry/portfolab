import type { OAuthProvider, Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { HttpError } from '../http.js'
import { randomToken, sha256 } from '../security/tokens.js'

export const REAUTH_COOKIE = 'pb_reauth'
export const REAUTH_COOKIE_PATH = '/api/me/delete'
export const REAUTH_GRANT_TTL_MS = 5 * 60 * 1000
export const DELETE_ACCOUNT_PURPOSE = 'delete_account'
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

export function reauthRequired() {
  return new HttpError(
    403,
    'REAUTH_REQUIRED',
    'محتاج تأكد هويتك من جديد بحسابك المربوط (Google أو GitHub) قبل ما تمسح الحساب.',
  )
}

function reauthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict' as const,
    path: REAUTH_COOKIE_PATH,
  }
}

export function setReauthCookie(res: Response, token: string) {
  res.cookie(REAUTH_COOKIE, token, { ...reauthCookieOptions(), maxAge: REAUTH_GRANT_TTL_MS })
}

export function clearReauthCookie(res: Response) {
  res.clearCookie(REAUTH_COOKIE, reauthCookieOptions())
}

export function readReauthCookie(req: Request): string | null {
  const raw: unknown = req.cookies?.[REAUTH_COOKIE]
  return typeof raw === 'string' && TOKEN_PATTERN.test(raw) ? raw : null
}

// Shared by every deletion path: anonymize, detach analytics, unlink providers, burn grants,
// and revoke sessions — all inside the caller's transaction.
export async function anonymizeUser(tx: Prisma.TransactionClient, userId: string) {
  const now = new Date()
  await tx.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.invalid`,
      displayName: 'Deleted user',
      passwordHash: `!disabled-${randomToken()}`,
      githubUrl: null,
      experienceLevel: null,
      weeklyHours: null,
      goal: null,
      analyticsConsent: false,
      deletedAt: now,
    },
  })
  await tx.leadEvent.updateMany({ where: { userId }, data: { userId: null } })
  await tx.oAuthIdentity.deleteMany({ where: { userId } })
  await tx.reauthGrant.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: now },
  })
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })
}

export async function deleteWithPassword(userId: string) {
  await prisma.$transaction((tx) => anonymizeUser(tx, userId))
}

// Returns the raw token for the cookie, or null when the bound session is no longer live.
export async function issueDeletionGrant(input: {
  userId: string
  sessionId: string
  provider: OAuthProvider
}): Promise<string | null> {
  const token = randomToken()
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const live = await tx.session.count({
      where: {
        id: input.sessionId,
        userId: input.userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { deletedAt: null },
      },
    })
    if (live !== 1) return null
    await tx.reauthGrant.updateMany({
      where: { sessionId: input.sessionId, purpose: DELETE_ACCOUNT_PURPOSE, consumedAt: null },
      data: { consumedAt: now },
    })
    await tx.reauthGrant.create({
      data: {
        tokenHash: sha256(token),
        userId: input.userId,
        sessionId: input.sessionId,
        provider: input.provider,
        purpose: DELETE_ACCOUNT_PURPOSE,
        expiresAt: new Date(now.getTime() + REAUTH_GRANT_TTL_MS),
      },
    })
    return token
  })
}

// Claims the grant and anonymizes in one transaction: a replayed, expired, foreign, or
// other-session grant rolls everything back.
export async function deleteWithGrant(input: { userId: string; sessionId: string; token: string }) {
  await prisma.$transaction(async (tx) => {
    const now = new Date()
    const claimed = await tx.reauthGrant.updateMany({
      where: {
        tokenHash: sha256(input.token),
        userId: input.userId,
        sessionId: input.sessionId,
        purpose: DELETE_ACCOUNT_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: now },
        session: { is: { revokedAt: null, expiresAt: { gt: now } } },
        user: { is: { deletedAt: null } },
      },
      data: { consumedAt: now },
    })
    if (claimed.count !== 1) throw reauthRequired()
    await anonymizeUser(tx, input.userId)
  })
}
