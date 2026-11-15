import { prisma } from '../db.js'
import { env } from '../env.js'

const DAY_MS = 24 * 60 * 60 * 1000

try {
  const cutoff = new Date(Date.now() - env.ANALYTICS_RETENTION_DAYS * DAY_MS)
  const deleted = await prisma.leadEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  const webhooks = await prisma.webhookEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  console.info(
    `[retention] removed ${deleted.count} first-party analytics events and ${webhooks.count} webhook records older than ${env.ANALYTICS_RETENTION_DAYS} days`,
  )
} catch (error) {
  console.error(`[retention] failed: ${error instanceof Error ? error.message : 'unknown'}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
