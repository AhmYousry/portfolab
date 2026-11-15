import { prisma } from '../db.js'
import { paymobStatus } from '../services/paymob.js'
import { reconcilePending } from '../services/payments.js'
import { shutdownAnalytics } from '../services/product-analytics.js'

const DEFAULT_OLDER_THAN_MINUTES = 10
const DEFAULT_LIMIT = 50

const olderThan = Number(process.argv[2] ?? DEFAULT_OLDER_THAN_MINUTES)
const limit = Number(process.argv[3] ?? DEFAULT_LIMIT)

try {
  const status = paymobStatus()
  if (!status.configured) {
    console.error(
      `[reconcile] Paymob not configured. Missing: ${status.missing.join(', ') || 'none'}; liveBlocked=${status.liveBlocked}`,
    )
    process.exitCode = 1
  } else {
    const results = await reconcilePending(olderThan, limit)
    console.info(`[reconcile] ${JSON.stringify(results)}`)
  }
} catch (error) {
  console.error(`[reconcile] failed: ${error instanceof Error ? error.message : 'unknown'}`)
  process.exitCode = 1
} finally {
  await shutdownAnalytics()
  await prisma.$disconnect()
}
