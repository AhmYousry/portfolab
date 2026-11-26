import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { env } from './env.js'
import { HttpError } from './http.js'
import { accountRouter } from './routes/account.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { checkoutRouter } from './routes/checkout.js'
import { neonAuthRouter } from './routes/neon-auth.js'
import { oauthRouter } from './routes/oauth.js'
import { publicRouter } from './routes/public.js'
import { resourcesRouter } from './routes/resources.js'
import { studentRouter } from './routes/student.js'
import { webhooksRouter } from './routes/webhooks.js'
import { csrfProtection } from './security/csrf.js'
import { loadSession } from './security/session.js'
import { neonAuthConfig } from './services/neon-auth.js'
import { webHandlers } from './web-static.js'

const JSON_LIMIT = '32kb'
const CLIENT_ERROR_MIN = 400
const SERVER_ERROR_MIN = 500
const NOT_FOUND_STATUS = 404

function notFound(_req: Request, res: Response) {
  res
    .status(NOT_FOUND_STATUS)
    .json({ data: null, error: { code: 'NOT_FOUND', message: 'المسار مش موجود' } })
}

function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null || !('status' in err)) return null
  const status = err.status
  if (typeof status !== 'number') return null
  return status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN ? status : null
}

export interface AppOptions {
  webDistDir?: string | null
}

export function createApp(options: AppOptions = {}) {
  const web = options.webDistDir ? webHandlers(options.webDistDir) : null
  const neon = neonAuthConfig()
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.isProd ? 1 : false)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'https:'],
          'frame-ancestors': ["'none'"],
          ...(neon ? { 'connect-src': ["'self'", new URL(neon.baseUrl).origin] } : {}),
        },
      },
    }),
  )
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  )
  if (web) app.use(web.assets)
  app.use('/api/webhooks', webhooksRouter)
  app.use(express.json({ limit: JSON_LIMIT }))
  app.use(cookieParser())
  app.use(loadSession)
  app.use(csrfProtection)

  const api = express.Router()
  api.use(publicRouter)
  api.use('/auth/oauth', oauthRouter)
  api.use('/auth/neon', neonAuthRouter)
  api.use('/auth', authRouter)
  api.use(studentRouter)
  api.use(resourcesRouter)
  api.use(accountRouter)
  api.use(checkoutRouter)
  api.use('/admin', adminRouter)
  app.use('/api', api)
  app.use('/api', notFound)
  if (web) app.use(web.spaFallback)
  app.use(notFound)

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err)
      return
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({
        data: null,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      })
      return
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ data: null, error: { code: 'BAD_JSON', message: 'JSON غير صالح' } })
      return
    }
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      err.type === 'entity.too.large'
    ) {
      res.status(413).json({ data: null, error: { code: 'TOO_LARGE', message: 'الطلب كبير جدًا' } })
      return
    }
    const clientStatus = clientErrorStatus(err)
    if (clientStatus !== null) {
      const code = clientStatus === NOT_FOUND_STATUS ? 'NOT_FOUND' : 'BAD_REQUEST'
      res.status(clientStatus).json({ data: null, error: { code, message: 'طلب غير صالح' } })
      return
    }
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`[api] unhandled error: ${message}`)
    res
      .status(500)
      .json({ data: null, error: { code: 'INTERNAL', message: 'حصلت مشكلة عندنا. جرب تاني.' } })
  })

  return app
}
