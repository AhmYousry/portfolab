import type { PostHog } from 'posthog-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type AnalyticsModule = typeof import('./analytics')
type ConsentModule = typeof import('./consent')

const TOKEN = 'phc_real_sdk_test_token'
const settle = () => new Promise((r) => setTimeout(r, 20))

let mod: AnalyticsModule
let consent: ConsentModule
let sdk: PostHog
const network: string[] = []

async function boot({ keepStorage = false } = {}) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_POSTHOG_KEY', TOKEN)
  if (!keepStorage) {
    localStorage.clear()
    sessionStorage.clear()
  }
  sdk = (await import('posthog-js')).default
  mod = await import('./analytics')
  consent = await import('./consent')
  mod.initAnalytics()
}

beforeEach(async () => {
  network.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      network.push(String(input))
      return new Response('{}', { status: 200 })
    }),
  )
  window.history.replaceState(null, '', '/')
  await boot()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('real posthog-js: consent lifecycle', () => {
  it('H-2: revoke leaves the SDK opted out (reset must not undo it) and blocks direct captures', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await settle()
    expect(sdk.__loaded).toBe(true)
    expect(sdk.has_opted_out_capturing()).toBe(false)

    consent.setConsent({ analytics: false, replay: false })
    expect(sdk.has_opted_out_capturing()).toBe(true)
    expect(sdk.capture('should_be_blocked')).toBeUndefined()
  })

  it('H-2: re-granting consent resumes capturing on the same instance', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await settle()
    consent.setConsent({ analytics: false, replay: false })
    consent.setConsent({ analytics: true, replay: false })
    await settle()
    expect(sdk.has_opted_out_capturing()).toBe(false)
    expect(sdk.capture('after_regrant')).toBeDefined()
  })

  it('H-2: a persisted opt-out from an earlier visit is cleared when consent is granted again', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await settle()
    consent.setConsent({ analytics: false, replay: false })
    expect(localStorage.getItem(`__ph_opt_in_out_${TOKEN}`)).not.toBeNull()

    consent.setConsent({ analytics: true, replay: false })
    await boot({ keepStorage: true })
    await settle()
    expect(sdk.has_opted_out_capturing()).toBe(false)
  })

  it('logout with consent keeps capturing for the next anonymous visitor', async () => {
    consent.setConsent({ analytics: true, replay: false })
    mod.analytics.identify({ id: 'user_logout', role: 'STUDENT', hasPro: false })
    await settle()
    mod.analytics.reset()
    expect(sdk.get_distinct_id()).not.toBe('user_logout')
    expect(sdk.has_opted_out_capturing()).toBe(false)
  })
})

describe('real posthog-js: identity', () => {
  it('H-1: user loaded before consent becomes the distinct id once consent is granted', async () => {
    const identify = vi.spyOn(sdk, 'identify')
    mod.analytics.identify({ id: 'user_h1', role: 'STUDENT', hasPro: false })
    await settle()
    expect(identify).not.toHaveBeenCalled()

    consent.setConsent({ analytics: true, replay: false })
    await settle()
    expect(sdk.get_distinct_id()).toBe('user_h1')
  })

  it('H-1: identity is restored after revoke and re-grant', async () => {
    consent.setConsent({ analytics: true, replay: false })
    mod.analytics.identify({ id: 'user_regrant', role: 'STUDENT', hasPro: false })
    await settle()
    consent.setConsent({ analytics: false, replay: false })
    expect(sdk.get_distinct_id()).not.toBe('user_regrant')
    consent.setConsent({ analytics: true, replay: false })
    await settle()
    expect(sdk.get_distinct_id()).toBe('user_regrant')
  })
})

describe('real posthog-js: pageviews and URL scrubbing', () => {
  it('H-4 + H-3: the landing pageview is sent after consent, and Paymob params never leave the browser', async () => {
    window.history.replaceState(
      null,
      '',
      '/checkout/status?purchase=cmabc12345&id=192036465&source_data.pan=2346&source_data.sub_type=MasterCard&amount_cents=24900&hmac=abc',
    )
    const capture = vi.spyOn(sdk, 'capture')
    mod.analytics.pageview(window.location.pathname, window.location.search)
    await settle()
    expect(capture).not.toHaveBeenCalled()

    consent.setConsent({ analytics: true, replay: false })
    await settle()

    const pageviews = capture.mock.calls
      .map((call, i) => ({ event: call[0], result: capture.mock.results[i]?.value }))
      .filter((c) => c.event === '$pageview')
    expect(pageviews).toHaveLength(1)

    const props = (pageviews[0]?.result as { properties: Record<string, unknown> }).properties
    expect(props.path).toBe('/checkout/status?purchase=cmabc12345')
    expect(String(props.$current_url)).toBe(
      'http://localhost:3000/checkout/status?purchase=cmabc12345',
    )
    const serialized = JSON.stringify(props)
    for (const leaked of ['2346', 'MasterCard', 'amount_cents', '192036465', 'hmac']) {
      expect(serialized).not.toContain(leaked)
    }
  })

  it('nothing reaches the network before consent', async () => {
    mod.analytics.pageview('/', '')
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    await settle()
    expect(network).toEqual([])
  })
})
