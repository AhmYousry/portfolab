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
import { publicRouter } from './routes/public.js'
import { resourcesRouter } from './routes/resources.js'
import { studentRouter } from './routes/student.js'
import { webhooksRouter } from './routes/webhooks.js'
import { csrfProtection } from './security/csrf.js'
import { loadSession } from './security/session.js'

const JSON_LIMIT = '32kb'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.isProd ? 1 : false)

  app.use(helmet())
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  )
  app.use('/api/webhooks', webhooksRouter)
  app.use(express.json({ limit: JSON_LIMIT }))
  app.use(cookieParser())
  app.use(loadSession)
  app.use(csrfProtection)

  const api = express.Router()
  api.use(publicRouter)
  api.use('/auth', authRouter)
  api.use(studentRouter)
  api.use(resourcesRouter)
  api.use(accountRouter)
  api.use(checkoutRouter)
  api.use('/admin', adminRouter)
  app.use('/api', api)

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'المسار مش موجود' } })
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`[api] unhandled error: ${message}`)
    res
      .status(500)
      .json({ data: null, error: { code: 'INTERNAL', message: 'حصلت مشكلة عندنا. جرب تاني.' } })
  })

  return app
}
