import fs from 'node:fs'
import path from 'node:path'
import { ANALYTICS_IDS, type PublicUser, sanitizeErrorText } from '@pb/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
  localStorage.clear()
  sessionStorage.clear()
  mod = await import('./analytics')
  consent = await import('./consent')
  ph = fakePosthog()
  mod.__setPosthogLoaderForTests(async () => ph as never)
  mod.initAnalytics()
  consent.setConsent({ analytics: true, replay: false })
  await flush()
})

const clicks = () => ph.capture.mock.calls.filter(([event]) => event === 'button_clicked')

describe('button_clicked', () => {
  it('trackClick sends the stable id, the scrubbed path and allowlisted context only', () => {
    window.history.replaceState(null, '', '/resources?token=abc')
    mod.trackClick('resource-download', {
      resource_id: 'taskflow-prompts',
      project_id: 'taskflow-lite',
    })
    expect(clicks()).toHaveLength(1)
    expect(clicks()[0]?.[1]).toEqual({
      analytics_id: 'resource-download',
      path: '/resources',
      resource_id: 'taskflow-prompts',
      project_id: 'taskflow-lite',
      device_type: expect.any(String),
    })
  })

  it('Button with analyticsId renders data-analytics-id and tracks the click', async () => {
    const { Button } = await import('../components/ui')
    render(<Button analyticsId="consent-accept">ok</Button>)
    const button = screen.getByRole('button', { name: 'ok' })
    expect(button).toHaveAttribute('data-analytics-id', 'consent-accept')
    fireEvent.click(button)
    expect(clicks().map(([, p]) => p.analytics_id)).toEqual(['consent-accept'])
  })

  it('submit buttons expose the id but are tracked by the form handler, not on click', async () => {
    const { Button } = await import('../components/ui')
    render(
      <form onSubmit={(e) => e.preventDefault()}>
        <Button type="submit" analyticsId="signup-submit">
          send
        </Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'send' })
    expect(button).toHaveAttribute('data-analytics-id', 'signup-submit')
    fireEvent.click(button)
    expect(clicks()).toHaveLength(0)
  })

  it('ButtonLink and TrackedLink track with context', async () => {
    const { ButtonLink, TrackedLink } = await import('../components/ui')
    render(
      <MemoryRouter>
        <ButtonLink to="/x" analyticsId="dashboard-continue" analyticsProps={{ lesson_id: 'l1' }}>
          go
        </ButtonLink>
        <TrackedLink to="/y" analyticsId="lesson-next" analyticsProps={{ lesson_id: 'l2' }}>
          next
        </TrackedLink>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'go' }))
    fireEvent.click(screen.getByRole('link', { name: 'next' }))
    expect(clicks().map(([, p]) => [p.analytics_id, p.lesson_id])).toEqual([
      ['dashboard-continue', 'l1'],
      ['lesson-next', 'l2'],
    ])
  })
})

describe('stable id registry', () => {
  const srcRoot = path.resolve(process.cwd(), 'src')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full)
    }
  }
  walk(srcRoot)
  const used = new Set<string>()
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(/(?:data-analytics-id|analyticsId)=["{']+([a-z0-9-]+)/g))
      used.add(m[1] ?? '')
    for (const m of text.matchAll(/(?:trackClick|tracked)\(\s*'([a-z0-9-]+)'/g))
      used.add(m[1] ?? '')
    for (const m of text.matchAll(/\bid: '([a-z0-9-]+)'/g)) if (m[1]?.includes('-')) used.add(m[1])
  }

  it('every id used in the UI is registered (no typos that would split rankings)', () => {
    const registry = new Set<string>(ANALYTICS_IDS)
    expect([...used].filter((id) => !registry.has(id))).toEqual([])
  })

  it('registry has no duplicates', () => {
    expect(new Set(ANALYTICS_IDS).size).toBe(ANALYTICS_IDS.length)
  })

  it('covers every control the business needs to rank', () => {
    const required = [
      'hero-free-cta',
      'signup-submit',
      'login-submit',
      'pricing-free-cta',
      'pricing-pro-cta',
      'project-start',
      'dashboard-continue',
      'lesson-prev',
      'lesson-next',
      'code-copy',
      'resource-download',
      'checkout-pay',
    ]
    expect(required.filter((id) => !used.has(id))).toEqual([])
  })

  it('no legacy data-attr remains', () => {
    const legacy = files.filter((f) => /data-attr=/.test(fs.readFileSync(f, 'utf8')))
    expect(legacy).toEqual([])
  })
})

describe('identity', () => {
  const user = (hasPro: boolean): Pick<PublicUser, 'id' | 'role' | 'hasPro'> => ({
    id: 'u_plan',
    role: 'STUDENT',
    hasPro,
  })

  it('re-identifies when the plan changes so the person property is never stale', () => {
    mod.analytics.identify(user(false))
    mod.analytics.identify(user(false))
    mod.analytics.identify(user(true))
    expect(ph.identify.mock.calls.map((c) => c[1])).toEqual([
      { role: 'STUDENT', plan: 'free' },
      { role: 'STUDENT', plan: 'pro' },
    ])
  })

  it('sends first-touch UTM as set-once person properties', () => {
    mod.captureUtm('?utm_source=instagram&utm_campaign=reel-12&utm_content=v2')
    mod.analytics.identify(user(false))
    expect(ph.identify).toHaveBeenCalledWith(
      'u_plan',
      { role: 'STUDENT', plan: 'free' },
      {
        initial_utm_source: 'instagram',
        initial_utm_campaign: 'reel-12',
        initial_utm_content: 'v2',
      },
    )
  })
})

describe('errors and replay', () => {
  it('client_error reasons are sanitized before sending', () => {
    mod.captureError(
      `Failed GET https://portfolab.test/reset-password?token=${'a'.repeat(64)} for someone@example.com id 01HZX9ABCDEF0123456789ABCDEF`,
      'window_error',
    )
    const [, props] = ph.capture.mock.calls.find(([e]) => e === 'client_error') ?? []
    const reason = String(props?.reason)
    expect(reason).not.toContain('aaaa')
    expect(reason).not.toContain('someone@example.com')
    expect(reason).not.toContain('01HZX9ABCDEF0123456789ABCDEF')
    expect(reason).toContain('[email]')
  })

  it('replay is blocked on admin and onboarding routes', () => {
    for (const p of ['/admin', '/admin/users', '/admin/lessons/x', '/onboarding']) {
      expect(mod.isReplayBlocked(p)).toBe(true)
    }
  })
})

describe('page-scoped events before a consent decision', () => {
  async function undecided() {
    vi.resetModules()
    localStorage.clear()
    mod = await import('./analytics')
    consent = await import('./consent')
    ph = fakePosthog()
    mod.__setPosthogLoaderForTests(async () => ph as never)
    mod.initAnalytics()
  }

  it('pro_page_viewed on the landing page is sent once, after the pageview, when consent is granted there', async () => {
    await undecided()
    window.history.replaceState(null, '', '/pricing')
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    mod.analytics.pageview('/pricing', '')
    await flush()
    expect(ph.capture).not.toHaveBeenCalled()
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.capture.mock.calls.map(([e]) => e)).toEqual(['$pageview', 'pro_page_viewed'])
  })

  it('is discarded if the visitor declines', async () => {
    await undecided()
    window.history.replaceState(null, '', '/pricing')
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    consent.setConsent({ analytics: false, replay: false })
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.capture.mock.calls.map(([e]) => e)).not.toContain('pro_page_viewed')
  })

  it('is dropped when the visitor navigates away before deciding', async () => {
    await undecided()
    window.history.replaceState(null, '', '/pricing')
    mod.analytics.capture('pro_page_viewed', { source: 'pricing' })
    mod.analytics.pageview('/pricing', '')
    window.history.replaceState(null, '', '/curriculum')
    mod.analytics.pageview('/curriculum', '')
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.capture.mock.calls.map(([e]) => e)).toEqual(['$pageview'])
  })

  it('non page-scoped events are never buffered', async () => {
    await undecided()
    mod.analytics.capture('signup_failed', { reason: 'CONFLICT' })
    consent.setConsent({ analytics: true, replay: false })
    await flush()
    expect(ph.capture.mock.calls.map(([e]) => e)).not.toContain('signup_failed')
  })
})

describe('consent sync', () => {
  it('flags a mismatch between this device and the server flag', async () => {
    const { consentNeedsSync } = await import('./auth')
    const u = { analyticsConsent: false } as PublicUser
    expect(consentNeedsSync({ analytics: true, replay: false }, u)).toBe(true)
    expect(consentNeedsSync({ analytics: false, replay: false }, u)).toBe(false)
    expect(consentNeedsSync(null, u)).toBe(false)
    expect(consentNeedsSync({ analytics: true, replay: false }, null)).toBe(false)
  })
})

describe('sanitizeErrorText', () => {
  it('keeps the message readable', () => {
    expect(sanitizeErrorText('Cannot read properties of undefined')).toBe(
      'Cannot read properties of undefined',
    )
  })
})
