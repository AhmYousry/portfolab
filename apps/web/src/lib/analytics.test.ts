import { beforeEach, describe, expect, it, vi } from 'vitest'

type AnalyticsModule = typeof import('./analytics')
type ConsentModule = typeof import('./consent')

function fakePosthog() {
  return {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    register: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
  }
}

let mod: AnalyticsModule
let consent: ConsentModule
let ph: ReturnType<typeof fakePosthog>

async function load(env: Record<string, string> = {}) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  localStorage.clear()
  sessionStorage.clear()
  mod = await import('./analytics')
  consent = await import('./consent')
  ph = fakePosthog()
  mod.__setPosthogLoaderForTests(async () => ph as never)
  mod.initAnalytics()
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(async () => {
  await load()
})

describe('consent gating', () => {
  it('loads and sends nothing before consent', async () => {
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    mod.analytics.pageview('/', '')
    await flush()
    expect(ph.init).not.toHaveBeenCalled()
    expect(ph.capture).not.toHaveBeenCalled()
  })

  it('declining keeps PostHog unloaded', async () => {
    consent.setConsent({ analytics: false, replay: false })
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    await flush()
    expect(ph.init).not.toHaveBeenCalled()
  })

  it('initializes with privacy settings after consent', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.init).toHaveBeenCalledTimes(1)
    const [key, config] = ph.init.mock.calls[0] as [string, Record<string, unknown>]
    expect(key).toBe('phc_test_key')
    expect(config).toMatchObject({
      person_profiles: 'identified_only',
      capture_pageview: false,
      disable_session_recording: true,
      session_recording: expect.objectContaining({ maskAllInputs: true }),
    })
  })

  it('revoking consent resets identity and THEN opts out (reset would undo an earlier opt-out)', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    consent.setConsent({ analytics: false, replay: false })
    expect(ph.stopSessionRecording).toHaveBeenCalled()
    expect(ph.reset).toHaveBeenCalled()
    expect(ph.opt_out_capturing).toHaveBeenCalled()
    expect(ph.reset.mock.invocationCallOrder[0]).toBeLessThan(
      ph.opt_out_capturing.mock.invocationCallOrder[0] ?? 0,
    )
    ph.capture.mockClear()
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    await flush()
    expect(ph.capture).not.toHaveBeenCalled()
  })

  it('H-2: re-granting consent opts back in on the same client without re-initializing', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    consent.setConsent({ analytics: false, replay: false })
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.init).toHaveBeenCalledTimes(1)
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    expect(ph.capture).toHaveBeenLastCalledWith(
      'pro_page_viewed',
      expect.objectContaining({ source: 'pricing' }),
    )
  })

  it('H-2: a persisted SDK opt-out is cleared at init when consent is granted', async () => {
    ph.has_opted_out_capturing.mockReturnValue(true)
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
  })

  it('H-1: a user identified before consent is identified once consent is granted', async () => {
    mod.analytics.identify({ id: 'user_before_consent', role: 'STUDENT', hasPro: false })
    await flush()
    expect(ph.identify).not.toHaveBeenCalled()
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.identify).toHaveBeenCalledTimes(1)
    expect(ph.identify).toHaveBeenCalledWith('user_before_consent', {
      role: 'STUDENT',
      plan: 'free',
    })
  })

  it('H-1: after revoke and re-grant the user is identified again', async () => {
    consent.setConsent({ analytics: true, replay: false })
    mod.analytics.identify({ id: 'u_regrant', role: 'STUDENT', hasPro: true })
    await flush()
    consent.setConsent({ analytics: false, replay: false })
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.identify).toHaveBeenCalledTimes(2)
    expect(ph.identify).toHaveBeenLastCalledWith('u_regrant', { role: 'STUDENT', plan: 'pro' })
  })

  it('H-4: the page visible when consent is granted gets exactly one $pageview', async () => {
    mod.captureUtm('?utm_source=instagram&utm_campaign=reel-09')
    mod.analytics.pageview('/', '?utm_source=instagram&utm_campaign=reel-09')
    await flush()
    expect(ph.capture).not.toHaveBeenCalled()
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    const pageviews = ph.capture.mock.calls.filter(([event]) => event === '$pageview')
    expect(pageviews).toHaveLength(1)
    expect(pageviews[0]?.[1]).toMatchObject({ path: '/?utm_source=instagram&utm_campaign=reel-09' })
    expect(ph.register).toHaveBeenCalledWith(
      expect.objectContaining({ utm_source: 'instagram', utm_campaign: 'reel-09' }),
    )
    mod.analytics.pageview('/', '?utm_source=instagram&utm_campaign=reel-09')
    expect(ph.capture.mock.calls.filter(([event]) => event === '$pageview')).toHaveLength(1)
  })

  it('H-4: when consent already exists, the first route still produces one pageview', async () => {
    await load()
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    mod.analytics.pageview('/pricing', '')
    await flush()
    expect(ph.capture.mock.calls.filter(([event]) => event === '$pageview')).toHaveLength(1)
  })

  it('logout while consent is revoked keeps the SDK opted out', async () => {
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    consent.setConsent({ analytics: false, replay: false })
    ph.opt_out_capturing.mockClear()
    mod.analytics.reset()
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1)
  })

  it('queues events captured right after consent until the SDK loads', async () => {
    consent.setConsent({ analytics: true, replay: false })
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    await flush()
    expect(ph.capture).toHaveBeenCalledWith(
      'pro_page_viewed',
      expect.objectContaining({ source: 'pricing' }),
    )
  })
})

describe('events and properties', () => {
  beforeEach(async () => {
    consent.setConsent({ analytics: true, replay: false })
    await flush()
  })

  it('drops non-allowlisted keys and email-like values, adds device_type', () => {
    mod.analytics.capture('feature_used', {
      feature_name: 'code_copied',
      source: 'someone@example.com',
      email: 'someone@example.com',
      password: 'hunter2',
    } as never)
    const [, props] = ph.capture.mock.calls.at(-1) as [string, Record<string, unknown>]
    expect(props).toEqual({ feature_name: 'code_copied', device_type: expect.any(String) })
  })

  it('identifies with the internal id and non-PII traits only, once per user', () => {
    const user = { id: 'user_123', role: 'STUDENT' as const, hasPro: false }
    mod.analytics.identify(user)
    mod.analytics.identify(user)
    expect(ph.identify).toHaveBeenCalledTimes(1)
    expect(ph.identify).toHaveBeenCalledWith('user_123', { role: 'STUDENT', plan: 'free' })
  })

  it('reset on logout clears identity so the next login re-identifies', () => {
    mod.analytics.identify({ id: 'u1', role: 'STUDENT', hasPro: false })
    mod.analytics.reset()
    expect(ph.reset).toHaveBeenCalledTimes(1)
    mod.analytics.identify({ id: 'u1', role: 'STUDENT', hasPro: false })
    expect(ph.identify).toHaveBeenCalledTimes(2)
  })

  it('pageviews redact secrets in the URL', () => {
    mod.analytics.pageview('/reset-password', `?token=${'a'.repeat(64)}`)
    const [event, props] = ph.capture.mock.calls.at(-1) as [string, Record<string, string>]
    expect(event).toBe('$pageview')
    expect(props.path).toBe('/reset-password?token=REDACTED')
    expect(props.path).not.toContain('aaaa')
  })

  it('before_send scrubs tokens from URL properties on every event', () => {
    const config = mod.posthogConfig({ analytics: true, replay: false })
    const event = {
      event: '$autocapture',
      properties: {
        $current_url: `http://localhost:5173/reset-password?token=${'b'.repeat(64)}`,
        $referrer:
          'https://accept.paymob.com/unifiedcheckout/?publicKey=pk&clientSecret=csk_secret',
      },
    }
    const out = config.before_send
      ? (config.before_send as unknown as (e: unknown) => typeof event)(event)
      : event
    expect(out.properties.$current_url).toContain('token=REDACTED')
    expect(out.properties.$referrer).toContain('clientSecret=REDACTED')
    expect(JSON.stringify(out)).not.toContain('csk_secret')
  })

  it('campaign attribution is registered from UTM parameters', () => {
    mod.captureUtm('?utm_source=instagram&utm_campaign=reel-07')
    mod.analytics.pageview('/', '?utm_source=instagram&utm_campaign=reel-07')
    expect(ph.register).toHaveBeenLastCalledWith(
      expect.objectContaining({
        utm_source: 'instagram',
        utm_campaign: 'reel-07',
        campaign: 'reel-07',
      }),
    )
  })
})

describe('session replay', () => {
  it('is never enabled without the build flag, even with replay consent', async () => {
    consent.setConsent({ analytics: true, replay: true })
    await flush()
    const [, config] = ph.init.mock.calls[0] as [string, Record<string, unknown>]
    expect(config.disable_session_recording).toBe(true)
  })

  it('with the flag and consent, it records but stops on sensitive routes', async () => {
    await load({ VITE_POSTHOG_REPLAY_ENABLED: 'true' })
    consent.setConsent({ analytics: true, replay: true })
    await flush()
    const [, config] = ph.init.mock.calls[0] as [string, Record<string, unknown>]
    expect(config.disable_session_recording).toBe(false)
    mod.analytics.syncReplayForPath('/checkout')
    expect(ph.stopSessionRecording).toHaveBeenCalled()
    mod.analytics.syncReplayForPath('/projects/taskflow-lite')
    expect(ph.startSessionRecording).toHaveBeenCalled()
  })

  it('blocks auth, account and payment routes', () => {
    for (const path of [
      '/login',
      '/signup',
      '/reset-password',
      '/account',
      '/checkout',
      '/checkout/status',
    ]) {
      expect(mod.isReplayBlocked(path)).toBe(true)
    }
    expect(mod.isReplayBlocked('/projects/taskflow-lite')).toBe(false)
  })
})

describe('resilience', () => {
  it('never throws when the SDK fails to load or throws', async () => {
    mod.__setPosthogLoaderForTests(async () => {
      throw new Error('blocked by adblock')
    })
    consent.setConsent({ analytics: true, replay: false })
    expect(() => mod.analytics.capture('pro_page_viewed', { source: 'x' })).not.toThrow()
    await flush()

    mod.__setPosthogLoaderForTests(async () => ph as never)
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    ph.capture.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => mod.analytics.capture('pro_page_viewed', { source: 'x' })).not.toThrow()
  })

  it('without a PostHog key nothing loads', async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    const m = await import('./analytics')
    const c = await import('./consent')
    const local = fakePosthog()
    m.__setPosthogLoaderForTests(async () => local as never)
    m.initAnalytics()
    c.setConsent({ analytics: true, replay: true })
    m.analytics.capture('pro_page_viewed', { source: 'x' })
    await flush()
    expect(local.init).not.toHaveBeenCalled()
  })
})
