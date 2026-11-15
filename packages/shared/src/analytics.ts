import { z } from 'zod'

export const ANALYTICS_EVENTS = [
  'landing_view',
  'free_cta_click',
  'signup_complete',
  'project_enrolled',
  'lesson_started',
  'checkpoint_completed',
  'free_project_completed',
  'pro_project_completed',
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

export type Plan = 'free' | 'pro'

export interface ProductEventMap {
  signup_completed: { source?: string; campaign?: string }
  login_completed: { source?: string }
  free_project_started: { project_id: string; source?: string }
  lesson_started: { project_id: string; lesson_id: string }
  lesson_completed: { project_id: string; lesson_id: string }
  prompt_copied: {
    project_id?: string
    lesson_id?: string
    prompt_id?: string
    feature_name: string
  }
  project_completed: { project_id: string; plan: Plan }
  pro_page_viewed: { source: string }
  checkout_started: { plan: 'pro'; source: string; amount_egp?: number }
  checkout_failed: { plan: 'pro'; source: string; reason: string }
  purchase_completed: {
    plan: 'pro'
    amount_egp: number
    currency: 'EGP'
    provider: 'paymob'
    purchase_id: string
  }
  feature_used: { feature_name: string; source?: string }
  client_error: { reason: string; feature_name?: string }
}

export type ProductEventName = keyof ProductEventMap

export const ALLOWED_PROPERTY_KEYS = new Set([
  'project_id',
  'lesson_id',
  'prompt_id',
  'feature_name',
  'source',
  'plan',
  'campaign',
  'device_type',
  'reason',
  'amount_egp',
  'currency',
  'provider',
  'purchase_id',
  'role',
  'path',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'app',
])

const MAX_PROPERTY_LENGTH = 200
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const SECRET_QUERY_PARAMS = ['token', 'hmac', 'clientSecret', 'client_secret', 'secret', 'code']

export type SafeProperties = Record<string, string | number | boolean>

export function sanitizeProperties(props: Record<string, unknown> | undefined): SafeProperties {
  const out: SafeProperties = {}
  if (!props) return out
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
      continue
    }
    if (typeof value !== 'string') continue
    if (EMAIL_LIKE.test(value)) continue
    out[key] = value.slice(0, MAX_PROPERTY_LENGTH)
  }
  return out
}

// Routes that receive third-party query strings (e.g. Paymob's redirect appends card brand,
// masked PAN, amounts and transaction ids). Only the listed keys survive on these routes.
export const ROUTE_QUERY_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  '/checkout/status': ['purchase'],
}

export function scrubUrl(raw: string): string {
  try {
    const url = new URL(raw, 'http://placeholder.invalid')
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
    const allowedKeys = ROUTE_QUERY_ALLOWLIST[route]
    if (allowedKeys) {
      for (const key of [...url.searchParams.keys()]) {
        if (!allowedKeys.includes(key)) url.searchParams.delete(key)
      }
    }
    for (const param of SECRET_QUERY_PARAMS) {
      if (url.searchParams.has(param)) url.searchParams.set(param, 'REDACTED')
    }
    const absolute = /^[a-z]+:\/\//i.test(raw)
    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}
