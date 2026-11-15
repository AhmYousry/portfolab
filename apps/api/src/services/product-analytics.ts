import { PostHog } from 'posthog-node'
import { type ProductEventMap, type ProductEventName, sanitizeProperties } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'

export interface AnalyticsSink {
  capture(
    distinctId: string,
    event: string,
    properties: Record<string, string | number | boolean>,
  ): void
  shutdown(): Promise<void>
}

class PostHogSink implements AnalyticsSink {
  private readonly client: PostHog

  constructor(apiKey: string, host: string) {
    this.client = new PostHog(apiKey, { host, flushAt: 20, flushInterval: 10_000 })
  }

  capture(
    distinctId: string,
    event: string,
    properties: Record<string, string | number | boolean>,
  ) {
    this.client.capture({ distinctId, event, properties: { ...properties, app: 'api' } })
  }

  async shutdown() {
    await this.client.shutdown()
  }
}

class NoopSink implements AnalyticsSink {
  capture() {}
  async shutdown() {}
}

let sink: AnalyticsSink = env.POSTHOG_API_KEY
  ? new PostHogSink(env.POSTHOG_API_KEY, env.POSTHOG_HOST)
  : new NoopSink()

export function setAnalyticsSink(next: AnalyticsSink) {
  sink = next
}

export async function shutdownAnalytics() {
  await sink.shutdown().catch(() => undefined)
}

export async function captureForUser<K extends ProductEventName>(
  userId: string,
  event: K,
  properties: ProductEventMap[K],
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { analyticsConsent: true, deletedAt: true },
    })
    if (!user?.analyticsConsent || user.deletedAt) return false
    sink.capture(userId, event, sanitizeProperties(properties as Record<string, unknown>))
    return true
  } catch {
    return false
  }
}
