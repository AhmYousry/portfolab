import { createApp } from './app.js'
import { prisma } from './db.js'
import { env } from './env.js'
import { shutdownAnalytics } from './services/product-analytics.js'
import { scheduleRetention } from './services/retention.js'

const server = createApp().listen(env.PORT, () => {
  console.info(`[api] listening on http://localhost:${env.PORT}`)
})

const stopRetention = scheduleRetention()

async function shutdown() {
  stopRetention()
  server.close()
  await shutdownAnalytics()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
