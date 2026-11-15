import type { AnalyticsEventName, Utm } from '@pb/shared'
import { prisma } from '../db.js'

interface TrackInput {
  event: AnalyticsEventName
  userId?: string | null
  anonymousId?: string | null
  path?: string | null
  utm?: Utm | null
}

export async function track(input: TrackInput) {
  await prisma.leadEvent.create({
    data: {
      event: input.event,
      userId: input.userId ?? null,
      anonymousId: input.anonymousId ?? null,
      path: input.path ?? null,
      utmSource: input.utm?.source ?? null,
      utmMedium: input.utm?.medium ?? null,
      utmCampaign: input.utm?.campaign ?? null,
      utmContent: input.utm?.content ?? null,
    },
  })
}

export async function trackOnce(input: TrackInput & { userId: string }): Promise<boolean> {
  const exists = await prisma.leadEvent.findFirst({
    where: { event: input.event, userId: input.userId, path: input.path ?? null },
    select: { id: true },
  })
  if (exists) return false
  await track(input)
  return true
}
