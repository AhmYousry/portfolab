import rateLimit from 'express-rate-limit'
import { env } from '../env.js'

const MINUTE_MS = 60 * 1000

function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    handler: (_req, res) => {
      res.status(429).json({
        data: null,
        error: { code: 'RATE_LIMITED', message: 'محاولات كتير. استنى شوية وجرب تاني.' },
      })
    },
  })
}

export const authLimiter = limiter(15 * MINUTE_MS, 20)
export const passwordResetLimiter = limiter(60 * MINUTE_MS, 5)
export const analyticsLimiter = limiter(MINUTE_MS, 60)
