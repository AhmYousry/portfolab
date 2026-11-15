import type { Utm } from '@pb/shared'
import { CLIENT_ANALYTICS_EVENTS } from '@pb/shared'
import { api } from './api'

type ClientEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number]

const CONSENT_KEY = 'pb_analytics_consent'
const ANON_KEY = 'pb_anon_id'
const UTM_KEY = 'pb_utm'
const UTM_FIELDS = ['source', 'medium', 'campaign', 'content'] as const
const UTM_MAX = 100

export type Consent = 'granted' | 'denied' | null

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
    /* storage unavailable: analytics silently disabled */
  }
}

export function getConsent(): Consent {
  const v = safeGet(localStorage, CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : null
}

export function setConsent(value: 'granted' | 'denied') {
  safeSet(localStorage, CONSENT_KEY, value)
  if (value === 'denied') {
    try {
      sessionStorage.removeItem(ANON_KEY)
    } catch {
      /* ignore */
    }
  }
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

function anonymousId(): string {
  const existing = safeGet(sessionStorage, ANON_KEY)
  if (existing) return existing
  const id = `a_${crypto.randomUUID().replaceAll('-', '')}`
  safeSet(sessionStorage, ANON_KEY, id)
  return id
}

export function trackEvent(event: ClientEvent, path = window.location.pathname) {
  if (getConsent() !== 'granted') return
  void api
    .post('/api/analytics/events', {
      event,
      path: path.slice(0, 200),
      anonymousId: anonymousId(),
      utm: getUtm(),
    })
    .catch(() => undefined)
}
