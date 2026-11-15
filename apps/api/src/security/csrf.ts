import type { NextFunction, Request, Response } from 'express'
import { env } from '../env.js'
import { errors } from '../http.js'
import { hmac, randomToken, safeEqual } from './tokens.js'

export const CSRF_COOKIE = 'pb_csrf'
export const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function sign(nonce: string) {
  return `${nonce}.${hmac(env.SESSION_SECRET, `csrf:${nonce}`)}`
}

function isValidSigned(token: string) {
  const [nonce, signature] = token.split('.')
  if (!nonce || !signature) return false
  return safeEqual(sign(nonce), token)
}

export function issueCsrf(req: Request, res: Response): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE]
  if (typeof existing === 'string' && isValidSigned(existing)) return existing
  const token = sign(randomToken())
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: CSRF_MAX_AGE_MS,
  })
  return token
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next()

  const origin = req.get('origin')
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    return next(errors.forbidden('Origin غير مسموح'))
  }

  const cookie: unknown = req.cookies?.[CSRF_COOKIE]
  const header = req.get(CSRF_HEADER)
  const valid =
    typeof cookie === 'string' &&
    typeof header === 'string' &&
    safeEqual(cookie, header) &&
    isValidSigned(cookie)
  if (!valid) return next(errors.forbidden('CSRF token غير صالح، اعمل refresh للصفحة'))
  next()
}
