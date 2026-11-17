import { prisma } from '../db.js'
import { env } from '../env.js'

const DAY_MS = 24 * 60 * 60 * 1000

export async function purgeExpiredAnalytics(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.ANALYTICS_RETENTION_DAYS * DAY_MS)
  const leadEvents = await prisma.leadEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  const webhookEvents = await prisma.webhookEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return { leadEvents: leadEvents.count, webhookEvents: webhookEvents.count, cutoff }
}

// Runs once shortly after boot and then daily. The timer is unref'd so it never keeps the process alive.
export function scheduleRetention(intervalMs = DAY_MS, firstRunDelayMs = 60_000) {
  const run = () => {
    purgeExpiredAnalytics()
      .then((r) => {
        if (r.leadEvents || r.webhookEvents) {
          console.info(
            `[retention] removed ${r.leadEvents} analytics and ${r.webhookEvents} webhook records`,
          )
        }
      })
      .catch(() => console.warn('[retention] purge failed; will retry next interval'))
  }
  const first = setTimeout(run, firstRunDelayMs)
  const timer = setInterval(run, intervalMs)
  first.unref()
  timer.unref()
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
