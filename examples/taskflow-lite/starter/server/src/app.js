import cors from 'cors'
import express from 'express'
import { prisma } from './db.js'
import { errorHandler, notFoundHandler } from './http.js'
import { taskRouter } from './tasks/task.routes.js'

const JSON_LIMIT = '16kb'

export function createApp({ clientOrigin = process.env.CLIENT_ORIGIN } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: clientOrigin ? clientOrigin.split(',') : false }))
  app.use(express.json({ limit: JSON_LIMIT }))

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', database: 'up' })
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' })
    }
  })

  app.use('/api/tasks', taskRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
