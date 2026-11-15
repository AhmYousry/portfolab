import type { PostHog, PostHogConfig } from 'posthog-js'
import {
  CLIENT_ANALYTICS_EVENTS,
  type ProductEventMap,
  type ProductEventName,
  type PublicUser,
  type Utm,
  sanitizeProperties,
  scrubUrl,
} from '@pb/shared'
import { useEffect, useRef } from 'react'
import { api } from './api'
import { type ConsentState, getConsent, onConsentChange } from './consent'

export { getConsent, setConsent, type ConsentState } from './consent'

type FirstPartyEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number]

const ANON_KEY = 'pb_anon_id'
const UTM_KEY = 'pb_utm'
const UTM_FIELDS = ['source', 'medium', 'campaign', 'content'] as const
const UTM_MAX = 100
const MOBILE_MAX_PX = 767
const TABLET_MAX_PX = 1024
const QUEUE_MAX = 50
const REASON_MAX = 200
const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$pathname',
]
const REPLAY_BLOCKED_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/account',
  '/checkout',
]

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'
const REPLAY_ALLOWED = import.meta.env.VITE_POSTHOG_REPLAY_ENABLED === 'true'

type Loader = () => Promise<PostHog>
type IdentityUser = Pick<PublicUser, 'id' | 'role' | 'hasPro'>
let loadPosthog: Loader = () => import('posthog-js').then((m) => m.default)
let client: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
let currentConsent: ConsentState | null = null
let currentUser: IdentityUser | null = null
let identifiedId: string | null = null
let lastRoute: { pathname: string; search: string } | null = null
let pageviewSentFor: string | null = null
const queue: Array<(ph: PostHog) => void> = []

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    /* storage unavailable: attribution is best-effort */
  }
}

function safely(fn: () => void) {
  try {
    fn()
  } catch {
    /* analytics must never break the app */
  }
}

export function deviceType(width = window.innerWidth): 'mobile' | 'tablet' | 'desktop' {
  if (width <= MOBILE_MAX_PX) return 'mobile'
  if (width <= TABLET_MAX_PX) return 'tablet'
  return 'desktop'
}

export function captureUtm(search: string) {
  const params = new URLSearchParams(search)
  const utm: Utm = {}
  for (const f of UTM_FIELDS) {
    const v = params.get(`utm_${f}`)
    if (v) utm[f] = v.slice(0, UTM_MAX)
  }
  if (Object.keys(utm).length > 0) safeSet(sessionStorage, UTM_KEY, JSON.stringify(utm))
}

export function getUtm(): Utm | undefined {
  const raw = safeGet(sessionStorage, UTM_KEY)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as Utm
  } catch {
    return undefined
  }
}

function superProperties() {
  const utm = getUtm()
  return sanitizeProperties({
    app: 'web',
    device_type: deviceType(),
    campaign: utm?.campaign,
    utm_source: utm?.source,
    utm_medium: utm?.medium,
    utm_campaign: utm?.campaign,
    utm_content: utm?.content,
  })
}

function scrubEventUrls(properties: Record<string, unknown>) {
  for (const key of URL_PROPERTIES) {
    const value = properties[key]
    if (typeof value === 'string') properties[key] = scrubUrl(value)
  }
}

export function posthogConfig(consent: ConsentState): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    capture_pageview: false,
    capture_pageleave: true,
    respect_dnt: true,
    autocapture: {
      dom_event_allowlist: ['click', 'submit', 'change'],
      element_allowlist: ['a', 'button', 'form', 'select', 'label'],
      css_selector_allowlist: ['[data-attr]', 'a', 'button', 'form'],
    },
    mask_all_element_attributes: false,
    mask_all_text: false,
    disable_session_recording: !(REPLAY_ALLOWED && consent.replay),
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '.ph-mask, [data-ph-mask], pre, code',
      blockSelector: '.ph-no-capture',
    },
    before_send: (event) => {
      if (!event) return null
      if (event.properties) scrubEventUrls(event.properties as Record<string, unknown>)
      if (event.$set) scrubEventUrls(event.$set as Record<string, unknown>)
      if (event.$set_once) scrubEventUrls(event.$set_once as Record<string, unknown>)
      return event
    },
  }
}

function syncReplay(ph: PostHog, pathname: string) {
  if (REPLAY_ALLOWED && currentConsent?.replay && !isReplayBlocked(pathname)) {
    ph.startSessionRecording()
  } else {
    ph.stopSessionRecording()
  }
}

async function ensureClient(): Promise<PostHog | null> {
  if (client) return client
  if (!POSTHOG_KEY || !currentConsent?.analytics) return null
  loading ??= loadPosthog()
    .then((ph) => {
      if (!currentConsent?.analytics) return null
      ph.init(POSTHOG_KEY, posthogConfig(currentConsent))
      if (ph.has_opted_out_capturing()) ph.opt_in_capturing({ captureEventName: false })
      ph.register(superProperties())
      syncReplay(ph, window.location.pathname)
      client = ph
      for (const fn of queue.splice(0)) safely(() => fn(ph))
      return ph
    })
    .catch(() => null)
    .finally(() => {
      loading = null
    })
  return loading
}

function withClient(fn: (ph: PostHog) => void) {
  if (!currentConsent?.analytics) return
  if (client) return safely(() => fn(client as PostHog))
  if (queue.length < QUEUE_MAX) queue.push(fn)
  void ensureClient()
}

function sendIdentify(ph: PostHog) {
  if (!currentUser || identifiedId === currentUser.id) return
  ph.identify(
    currentUser.id,
    sanitizeProperties({ role: currentUser.role, plan: currentUser.hasPro ? 'pro' : 'free' }),
  )
  identifiedId = currentUser.id
}

function sendPageview(ph: PostHog, pathname: string, search: string) {
  const path = scrubUrl(`${pathname}${search}`)
  if (pageviewSentFor === path) return
  ph.register(superProperties())
  ph.capture('$pageview', { $current_url: scrubUrl(window.location.href), path })
  pageviewSentFor = path
}

function onConsentGranted() {
  withClient((ph) => {
    sendIdentify(ph)
    if (lastRoute) sendPageview(ph, lastRoute.pathname, lastRoute.search)
  })
}

function applyConsent(state: ConsentState | null) {
  const wasGranted = currentConsent?.analytics === true
  currentConsent = state
  if (!state?.analytics) {
    queue.length = 0
    identifiedId = null
    pageviewSentFor = null
    if (client) {
      const ph = client
      safely(() => {
        ph.stopSessionRecording()
        ph.reset()
        ph.opt_out_capturing()
      })
    }
    return
  }
  if (client) {
    const ph = client
    safely(() => {
      ph.opt_in_capturing({ captureEventName: false })
      syncReplay(ph, window.location.pathname)
    })
  }
  if (!wasGranted) onConsentGranted()
}

export function initAnalytics() {
  applyConsent(getConsent())
  onConsentChange(applyConsent)
  window.addEventListener('error', (e) => captureError(e.message, 'window_error'))
  window.addEventListener('unhandledrejection', () =>
    captureError('unhandled_rejection', 'promise'),
  )
}

export const analytics = {
  capture<K extends ProductEventName>(event: K, properties: ProductEventMap[K]) {
    const props = sanitizeProperties({ ...properties, device_type: deviceType() })
    withClient((ph) => ph.capture(event, props))
  },

  pageview(pathname: string, search: string) {
    lastRoute = { pathname, search }
    withClient((ph) => sendPageview(ph, pathname, search))
  },

  identify(user: IdentityUser) {
    currentUser = user
    withClient(sendIdentify)
  },

  reset() {
    currentUser = null
    identifiedId = null
    queue.length = 0
    if (client) {
      const ph = client
      safely(() => {
        ph.reset()
        if (!currentConsent?.analytics) ph.opt_out_capturing()
      })
    }
  },

  syncReplayForPath(pathname: string) {
    if (!client || !currentConsent?.analytics) return
    const ph = client
    safely(() => syncReplay(ph, pathname))
  },
}

export function isReplayBlocked(pathname: string): boolean {
  return REPLAY_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function captureError(reason: string, featureName?: string) {
  analytics.capture('client_error', {
    reason: reason.slice(0, REASON_MAX),
    feature_name: featureName,
  })
}

function anonymousId(): string {
  const existing = safeGet(sessionStorage, ANON_KEY)
  if (existing) return existing
  const id = `a_${crypto.randomUUID().replaceAll('-', '')}`
  safeSet(sessionStorage, ANON_KEY, id)
  return id
}

export function trackEvent(event: FirstPartyEvent, path = window.location.pathname) {
  if (!getConsent()?.analytics) return
  void api
    .post('/api/analytics/events', {
      event,
      path: path.slice(0, 200),
      anonymousId: anonymousId(),
      utm: getUtm(),
    })
    .catch(() => undefined)
}

export function useAnalyticsRouting(
  pathname: string,
  search: string,
  user: PublicUser | null | undefined,
) {
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    captureUtm(search)
    const key = `${pathname}${search}`
    if (lastPath.current === key) return
    lastPath.current = key
    analytics.pageview(pathname, search)
    analytics.syncReplayForPath(pathname)
  }, [pathname, search])

  useEffect(() => {
    if (user) analytics.identify(user)
  }, [user])
}

export function __setPosthogLoaderForTests(loader: Loader) {
  loadPosthog = loader
  client = null
  loading = null
  currentUser = null
  identifiedId = null
  lastRoute = null
  pageviewSentFor = null
  queue.length = 0
}
