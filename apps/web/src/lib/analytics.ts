import type { PostHog, PostHogConfig } from 'posthog-js'
import {
  type AnalyticsId,
  CLIENT_ANALYTICS_EVENTS,
  type ProductEventMap,
  type ProductEventName,
  type PublicUser,
  type Utm,
  sanitizeErrorText,
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
const PENDING_PAGE_EVENTS_MAX = 5
// View-type events that describe the page itself. If the visitor has not decided on consent yet,
// they are held in memory (never sent) and replayed once only if consent is granted on that page.
const PAGE_SCOPED_EVENTS = new Set<ProductEventName>(['pro_page_viewed', 'lesson_previewed'])
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
  '/onboarding',
  '/admin',
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
let pendingPageEvents: {
  pathname: string
  event: string
  props: Record<string, string | number | boolean>
}[] = []
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
      element_allowlist: ['a', 'button', 'form', 'select', 'label', 'input'],
      css_selector_allowlist: [
        '[data-analytics-id]',
        'a',
        'button',
        'form',
        'select',
        'label',
        'input[type="checkbox"]',
      ],
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

function identityKey(user: IdentityUser) {
  return `${user.id}:${user.hasPro ? 'pro' : 'free'}`
}

function sendIdentify(ph: PostHog) {
  if (!currentUser || identifiedId === identityKey(currentUser)) return
  const utm = getUtm()
  ph.identify(
    currentUser.id,
    sanitizeProperties({ role: currentUser.role, plan: currentUser.hasPro ? 'pro' : 'free' }),
    sanitizeProperties({
      initial_utm_source: utm?.source,
      initial_utm_medium: utm?.medium,
      initial_utm_campaign: utm?.campaign,
      initial_utm_content: utm?.content,
    }),
  )
  identifiedId = identityKey(currentUser)
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
    const here = window.location.pathname
    for (const pending of pendingPageEvents) {
      if (pending.pathname === here) ph.capture(pending.event, pending.props)
    }
    pendingPageEvents = []
  })
}

function applyConsent(state: ConsentState | null) {
  const wasGranted = currentConsent?.analytics === true
  currentConsent = state
  if (!state?.analytics) {
    queue.length = 0
    pendingPageEvents = []
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
    const undecided = currentConsent === null
    if (undecided && PAGE_SCOPED_EVENTS.has(event)) {
      if (pendingPageEvents.length < PENDING_PAGE_EVENTS_MAX) {
        pendingPageEvents.push({ pathname: window.location.pathname, event, props })
      }
      return
    }
    withClient((ph) => ph.capture(event, props))
  },

  pageview(pathname: string, search: string) {
    if (lastRoute?.pathname !== pathname) {
      pendingPageEvents = pendingPageEvents.filter((e) => e.pathname === pathname)
    }
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

export type ClickProps = Pick<
  ProductEventMap['button_clicked'],
  'resource_id' | 'project_id' | 'lesson_id'
>

export function trackClick(analyticsId: AnalyticsId, props: ClickProps = {}) {
  analytics.capture('button_clicked', {
    analytics_id: analyticsId,
    path: scrubUrl(window.location.pathname),
    ...props,
  })
}

export function isReplayBlocked(pathname: string): boolean {
  return REPLAY_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function captureError(reason: string, featureName?: string) {
  analytics.capture('client_error', {
    reason: sanitizeErrorText(reason).slice(0, REASON_MAX),
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
  pendingPageEvents = []
  queue.length = 0
}
