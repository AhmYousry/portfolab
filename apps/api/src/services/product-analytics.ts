import { PostHog } from 'posthog-node'
import { type ProductEventMap, type ProductEventName, sanitizeProperties } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'

type SafeProps = Record<string, string | number | boolean>

export interface AnalyticsSink {
  capture(distinctId: string, event: string, properties: SafeProps, set?: SafeProps): void
  flush?(): Promise<void>
  shutdown(): Promise<void>
}

const FLUSH_AT = 20
const FLUSH_INTERVAL_MS = 10_000

class PostHogSink implements AnalyticsSink {
  private readonly client: PostHog

  constructor(apiKey: string, host: string) {
    this.client = new PostHog(apiKey, { host, flushAt: FLUSH_AT, flushInterval: FLUSH_INTERVAL_MS })
  }

  capture(distinctId: string, event: string, properties: SafeProps, set?: SafeProps) {
    this.client.capture({
      distinctId,
      event,
      properties: { ...properties, app: 'api', ...(set ? { $set: set } : {}) },
    })
  }

  async flush() {
    await this.client.flush()
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

export interface CaptureOptions {
  setPersonProperties?: Record<string, unknown>
  // Revenue-relevant events are flushed immediately instead of waiting for the batch.
  flush?: boolean
}

export async function captureForUser<K extends ProductEventName>(
  userId: string,
  event: K,
  properties: ProductEventMap[K],
  options: CaptureOptions = {},
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { analyticsConsent: true, deletedAt: true },
    })
    if (!user?.analyticsConsent || user.deletedAt) return false
    const set = options.setPersonProperties
      ? sanitizeProperties(options.setPersonProperties)
      : undefined
    sink.capture(userId, event, sanitizeProperties(properties as Record<string, unknown>), set)
    if (options.flush) await sink.flush?.().catch(() => undefined)
    return true
  } catch {
    return false
  }
}
