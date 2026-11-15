import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { randomToken, sha256 } from './tokens.js'

export const SESSION_COOKIE = 'pb_session'
const DAY_MS = 24 * 60 * 60 * 1000
const USER_AGENT_MAX = 200

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/',
    ...(expires ? { expires } : {}),
  }
}

export async function createSession(req: Request, res: Response, userId: string) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * DAY_MS)
  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: sha256(token),
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, USER_AGENT_MAX) ?? null,
    },
  })
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}

export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE]
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return next()

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: sha256(token) },
    include: { user: true },
  })
  const valid =
    session && !session.revokedAt && session.expiresAt > new Date() && !session.user.deletedAt
  if (valid) {
    req.user = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
      sessionId: session.id,
    }
  }
  next()
}
