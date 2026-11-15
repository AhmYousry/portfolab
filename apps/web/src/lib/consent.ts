const CONSENT_KEY = 'pb_analytics_consent'
const CONSENT_VERSION = 2

export interface ConsentState {
  analytics: boolean
  replay: boolean
}

type Listener = (state: ConsentState | null) => void
const listeners = new Set<Listener>()

function read(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

export function getConsent(): ConsentState | null {
  const raw = read()
  if (!raw) return null
  if (raw === 'granted') return { analytics: true, replay: false }
  if (raw === 'denied') return { analytics: false, replay: false }
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState> & { v?: number }
    if (parsed.v !== CONSENT_VERSION) return null
    const analytics = parsed.analytics === true
    return { analytics, replay: analytics && parsed.replay === true }
  } catch {
    return null
  }
}

export function setConsent(state: ConsentState) {
  const normalized = { analytics: state.analytics, replay: state.analytics && state.replay }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...normalized, v: CONSENT_VERSION }))
  } catch {
    /* storage blocked: consent applies to this page view only */
  }
  for (const l of listeners) l(normalized)
}

export function clearConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(null)
}

export function onConsentChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
