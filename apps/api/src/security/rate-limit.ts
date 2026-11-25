import type { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../env.js'

const MINUTE_MS = 60 * 1000

function jsonLimited(_req: Request, res: Response) {
  res.status(429).json({
    data: null,
    error: { code: 'RATE_LIMITED', message: 'محاولات كتير. استنى شوية وجرب تاني.' },
  })
}

function limiter(windowMs: number, limit: number, handler = jsonLimited) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    handler,
  })
}

export const authLimiter = limiter(15 * MINUTE_MS, 20)
export const passwordResetLimiter = limiter(60 * MINUTE_MS, 5)
export const analyticsLimiter = limiter(MINUTE_MS, 60)
export const oauthStartLimiter = limiter(15 * MINUTE_MS, 20)
export const oauthCallbackLimiter = limiter(15 * MINUTE_MS, 30, (_req, res) => {
  res.redirect(303, `${new URL(env.APP_URL).origin}/login?oauth_error=rate_limited`)
})
