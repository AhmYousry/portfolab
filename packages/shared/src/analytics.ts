import { z } from 'zod'

export const ANALYTICS_EVENTS = [
  'landing_view',
  'free_cta_click',
  'signup_complete',
  'project_enrolled',
  'lesson_started',
  'checkpoint_completed',
  'free_project_completed',
  'pro_offer_view',
  'checkout_started',
  'purchase_confirmed',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

export const CLIENT_ANALYTICS_EVENTS = [
  'landing_view',
  'free_cta_click',
  'lesson_started',
  'pro_offer_view',
] as const satisfies readonly AnalyticsEventName[]

const UTM_MAX = 100
const utmField = z.string().trim().max(UTM_MAX).optional()

export const utmSchema = z.object({
  source: utmField,
  medium: utmField,
  campaign: utmField,
  content: utmField,
})

export type Utm = z.infer<typeof utmSchema>

export const analyticsEventSchema = z.object({
  event: z.enum(CLIENT_ANALYTICS_EVENTS),
  anonymousId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{8,64}$/)
    .optional(),
  path: z.string().max(200).startsWith('/').optional(),
  utm: utmSchema.optional(),
})

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>
