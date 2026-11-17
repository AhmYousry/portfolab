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

// lesson_started is written by the server only (on first lesson progress) to avoid double counting.
export const CLIENT_ANALYTICS_EVENTS = [
  'landing_view',
  'free_cta_click',
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

// Stable ids for every tracked UI control. Rendered as data-analytics-id and sent as
// `analytics_id` on `button_clicked`, so rankings survive copy and layout changes.
export const ANALYTICS_IDS = [
  'nav-logo',
  'nav-curriculum',
  'nav-pricing',
  'nav-dashboard',
  'nav-progress',
  'nav-resources',
  'nav-admin',
  'nav-account',
  'nav-login',
  'nav-signup',
  'nav-logout',
  'nav-menu-toggle',
  'footer-privacy',
  'footer-terms',
  'footer-refund',
  'footer-contact',
  'footer-privacy-settings',
  'hero-free-cta',
  'hero-preview-lesson',
  'landing-curriculum-link',
  'pricing-free-cta',
  'pricing-pro-cta',
  'project-card',
  'project-start',
  'project-signup-cta',
  'project-lesson-link',
  'dashboard-continue',
  'dashboard-start-taskflow',
  'progress-lesson-link',
  'lesson-prev',
  'lesson-next',
  'lesson-breadcrumb-project',
  'lesson-locked-signup',
  'lesson-locked-login',
  'lesson-pro-pricing',
  'code-copy',
  'code-spoiler-toggle',
  'checkpoint-toggle',
  'resource-download',
  'signup-submit',
  'login-submit',
  'forgot-password-submit',
  'reset-password-submit',
  'onboarding-save',
  'onboarding-skip',
  'checkout-pay',
  'checkout-retry',
  'checkout-dashboard',
  'consent-accept',
  'consent-decline',
] as const

export type AnalyticsId = (typeof ANALYTICS_IDS)[number]

export interface ProductEventMap {
  signup_completed: { source?: string; campaign?: string }
  signup_failed: { reason: string }
  login_completed: { source?: string }
  login_failed: { reason: string }
  logged_out: { source?: string }
  onboarding_completed: { source: 'saved' | 'skipped' }
  button_clicked: {
    analytics_id: AnalyticsId
    path: string
    resource_id?: string
    project_id?: string
    lesson_id?: string
  }
  free_project_started: { project_id: string; source?: string }
  pro_project_started: { project_id: string; source?: string }
  lesson_previewed: { project_id: string; lesson_id: string }
  lesson_started: { project_id: string; lesson_id: string }
  lesson_completed: { project_id: string; lesson_id: string }
  checkpoint_completed: { project_id: string; lesson_id: string; checkpoint_id: string }
  resource_downloaded: { resource_id: string; project_id?: string; plan: Plan }
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
  purchase_refunded: {
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
  'checkpoint_id',
  'resource_id',
  'analytics_id',
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
  'initial_utm_source',
  'initial_utm_medium',
  'initial_utm_campaign',
  'initial_utm_content',
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

const ERROR_TEXT_MAX = 200
const URL_IN_TEXT = /\b(?:https?:\/\/|\/)[^\s"'<>]*\?[^\s"'<>]*/gi
const EMAIL_IN_TEXT = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g
const LONG_TOKEN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}\b/g
const CARD_LIKE = /\b(?:\d[ -]?){12,19}\b/g

// Error messages can embed URLs (with tokens), emails or ids. Strip them before sending.
export function sanitizeErrorText(raw: string): string {
  return raw
    .replace(URL_IN_TEXT, (match) => scrubUrl(match).split('?')[0] + '?[query]')
    .replace(EMAIL_IN_TEXT, '[email]')
    .replace(CARD_LIKE, '[number]')
    .replace(LONG_TOKEN, '[token]')
    .slice(0, ERROR_TEXT_MAX)
}
