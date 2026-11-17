import { prisma } from '../db.js'
import { env } from '../env.js'
import { purgeExpiredAnalytics } from '../services/retention.js'

try {
  const result = await purgeExpiredAnalytics()
  console.info(
    `[retention] removed ${result.leadEvents} first-party analytics events and ${result.webhookEvents} webhook records older than ${env.ANALYTICS_RETENTION_DAYS} days`,
  )
} catch (error) {
  console.error(`[retention] failed: ${error instanceof Error ? error.message : 'unknown'}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
