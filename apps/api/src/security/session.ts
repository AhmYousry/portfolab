import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { neonAuthEnabled } from '../services/auth-mode.js'
import { upstreamSession } from '../services/neon-auth.js'
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

export interface SessionBinding {
  neonSessionId: string
  notAfter: Date
}

// A Neon-bound session never outlives its upstream session and is re-checked on every request.
export async function createSession(
  req: Request,
  res: Response,
  userId: string,
  binding?: SessionBinding,
) {
  const token = randomToken()
  const localExpiry = Date.now() + env.SESSION_TTL_DAYS * DAY_MS
  const expiresAt = new Date(
    binding ? Math.min(localExpiry, binding.notAfter.getTime()) : localExpiry,
  )
  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: sha256(token),
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, USER_AGENT_MAX) ?? null,
      neonSessionId: binding?.neonSessionId ?? null,
    },
  })
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
}

interface BoundSession {
  id: string
  neonSessionId: string | null
  user: { neonIdentity: { subject: string } | null }
}

// Neon mode accepts only Neon-bound sessions whose upstream session is still live; other modes
// accept only unbound sessions. A lookup failure fails closed without revoking.
async function bindingLive(session: BoundSession): Promise<boolean> {
  if (!neonAuthEnabled()) return session.neonSessionId === null
  const subject = session.user.neonIdentity?.subject
  if (!session.neonSessionId || !subject) return false
  try {
    if (await upstreamSession(session.neonSessionId, subject)) return true
  } catch (err) {
    console.error('[neon-auth] upstream session check failed', {
      error: err instanceof Error ? err.name : 'unknown',
    })
    return false
  }
  await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return false
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
    include: { user: { include: { neonIdentity: { select: { subject: true } } } } },
  })
  const valid =
    session && !session.revokedAt && session.expiresAt > new Date() && !session.user.deletedAt
  if (valid && (await bindingLive(session))) {
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
