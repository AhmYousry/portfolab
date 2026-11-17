import { gunzipSync } from 'node:zlib'
import { type Page, type Request, expect, test } from '@playwright/test'

// Runs the real posthog-js in Chromium with a fake api_host. Every request to that host is
// intercepted here and decoded, so we assert on the exact payloads PostHog would receive.
const FAKE_HOST = 'https://posthog.e2e.test'
const PASSWORD = 'e2e-analytics-password-123'

interface CapturedEvent {
  event: string
  properties: Record<string, unknown>
}

interface Capture {
  events: CapturedEvent[]
  rawBodies: string[]
  requests: string[]
}

function decodeBody(request: Request): string {
  const buffer = request.postDataBuffer()
  if (!buffer) return ''
  const url = new URL(request.url())
  const compression = url.searchParams.get('compression')
  if (compression === 'gzip-js' || compression === 'gzip')
    return gunzipSync(buffer).toString('utf8')
  const text = buffer.toString('utf8')
  if (compression === 'base64') return Buffer.from(text, 'base64').toString('utf8')
  if (text.startsWith('data=')) {
    const value = decodeURIComponent(text.slice('data='.length))
    return /^[[{]/.test(value) ? value : Buffer.from(value, 'base64').toString('utf8')
  }
  return text
}

function toEvents(body: string): CapturedEvent[] {
  if (!body) return []
  try {
    const parsed = JSON.parse(body) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { batch?: unknown[] }).batch ?? [parsed])
    return list.filter((e): e is CapturedEvent => typeof (e as CapturedEvent)?.event === 'string')
  } catch {
    return []
  }
}

async function interceptPosthog(page: Page): Promise<Capture> {
  const capture: Capture = { events: [], rawBodies: [], requests: [] }
  // posthog-js treats navigator.webdriver === true (any automated browser) as a bot and drops events.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
  })
  await page.route(`${FAKE_HOST}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    capture.requests.push(url.pathname)
    if (url.pathname.includes('/config')) {
      const config = {
        autocapture_opt_out: false,
        sessionRecording: false,
        supportedCompression: [],
      }
      return route.fulfill(
        url.pathname.endsWith('.js')
          ? { contentType: 'application/javascript', body: '' }
          : { contentType: 'application/json', body: JSON.stringify(config) },
      )
    }
    if (url.pathname.includes('/flags') || url.pathname.includes('/decide')) {
      return route.fulfill({ contentType: 'application/json', body: '{"featureFlags":{}}' })
    }
    if (url.pathname.endsWith('.js')) {
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    }
    const body = decodeBody(request)
    if (process.env.PH_E2E_DEBUG) {
      console.log('PH', request.method(), url.pathname + url.search, body.slice(0, 160))
    }
    capture.rawBodies.push(body)
    capture.events.push(...toEvents(body))
    return route.fulfill({ contentType: 'application/json', body: '{"status":1}' })
  })
  return capture
}

const named = (c: Capture, event: string) => c.events.filter((e) => e.event === event)
const clickIds = (c: Capture) => named(c, 'button_clicked').map((e) => e.properties.analytics_id)

async function waitForEvent(c: Capture, predicate: (e: CapturedEvent) => boolean) {
  await expect.poll(() => c.events.some(predicate), { timeout: 15_000 }).toBe(true)
}

async function acceptConsent(page: Page) {
  await page.getByRole('button', { name: 'موافق' }).click()
}

test('nothing is sent before consent; after consent the landing pageview and CTA clicks arrive', async ({
  page,
}) => {
  const capture = await interceptPosthog(page)
  await page.goto('/?utm_source=instagram&utm_campaign=e2e-analytics')
  await page.waitForTimeout(1500)
  expect(capture.requests).toEqual([])

  await acceptConsent(page)
  await waitForEvent(
    capture,
    (e) =>
      e.event === '$pageview' &&
      e.properties.path === '/?utm_source=instagram&utm_campaign=e2e-analytics',
  )
  const landing = named(capture, '$pageview')[0]
  expect(landing?.properties.utm_source).toBe('instagram')
  expect(landing?.properties.utm_campaign).toBe('e2e-analytics')
  expect(named(capture, '$pageview')).toHaveLength(1)

  await page.getByRole('link', { name: /اقرا أول درس/ }).click()
  await waitForEvent(capture, (e) => e.event === 'lesson_previewed')
  expect(clickIds(capture)).toContain('hero-preview-lesson')
  expect(named(capture, 'lesson_started')).toEqual([])

  const autocaptured = named(capture, '$autocapture').map((e) => JSON.stringify(e.properties))
  expect(autocaptured.some((p) => p.includes('hero-preview-lesson'))).toBe(true)
})

test('signup, identity, failures, checkout URL scrubbing and logout — with no PII in any payload', async ({
  page,
}) => {
  const capture = await interceptPosthog(page)
  const email = `analytics-${Date.now()}@example.test`

  await page.goto('/login')
  await acceptConsent(page)
  await page.getByLabel('الإيميل', { exact: true }).fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill('wrong-password-xyz')
  await page.getByRole('button', { name: 'دخول' }).click()
  await waitForEvent(capture, (e) => e.event === 'login_failed')
  expect(named(capture, 'login_failed')[0]?.properties.reason).toBe('UNAUTHORIZED')
  expect(clickIds(capture)).toContain('login-submit')

  await page.goto('/signup')
  await page.getByLabel('اسمك').fill('Analytics Student')
  await page.getByLabel('الإيميل', { exact: true }).fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'اعمل حساب' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await waitForEvent(capture, (e) => e.event === 'signup_completed')
  expect(clickIds(capture)).toContain('signup-submit')

  const userId = await page.evaluate(async () => {
    const res = await fetch('/api/auth/me')
    return ((await res.json()) as { data: { user: { id: string } } }).data.user.id
  })
  await waitForEvent(capture, (e) => e.event === '$identify')
  const identify = named(capture, '$identify')[0]
  expect(identify?.properties.distinct_id).toBe(userId)
  const signupEvent = named(capture, 'signup_completed')[0]
  expect(signupEvent?.properties.distinct_id).toBe(userId)

  await page.getByRole('button', { name: 'تخطى' }).click()
  await waitForEvent(capture, (e) => e.event === 'onboarding_completed')
  expect(named(capture, 'onboarding_completed')[0]?.properties.source).toBe('skipped')

  await page.goto(
    '/checkout/status?purchase=cmnotreal12345&id=192036465&source_data.pan=2346&source_data.sub_type=MasterCard&amount_cents=24900&hmac=abc',
  )
  await waitForEvent(
    capture,
    (e) => e.event === '$pageview' && String(e.properties.path).startsWith('/checkout/status'),
  )

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(page).toHaveURL('/')
  await waitForEvent(capture, (e) => e.event === 'logged_out')
  expect(named(capture, 'logged_out')[0]?.properties.distinct_id).toBe(userId)
  expect(clickIds(capture)).toContain('nav-logout')

  await waitForEvent(capture, (e) => e.event === '$pageview' && e.properties.distinct_id !== userId)

  const everything = capture.rawBodies.join('\n')
  expect(everything).not.toContain(email)
  expect(everything).not.toContain(PASSWORD)
  expect(everything).not.toContain('wrong-password-xyz')
  expect(everything).not.toContain('Analytics Student')
  for (const leaked of ['2346', 'MasterCard', 'amount_cents', '192036465', 'hmac=abc']) {
    expect(everything).not.toContain(leaked)
  }
})

test('revoking consent stops all traffic, including autocapture', async ({ page }) => {
  const capture = await interceptPosthog(page)
  await page.goto('/pricing')
  await acceptConsent(page)
  await waitForEvent(capture, (e) => e.event === 'pro_page_viewed')

  await page.getByRole('button', { name: 'إعدادات التحليلات' }).click()
  await page.getByRole('button', { name: 'لأ، شكرًا' }).click()
  const revokedAt = await page.evaluate(() => Date.now())

  await page.getByRole('link', { name: 'المنهج' }).first().click()
  await page
    .getByRole('link', { name: /TaskFlow Lite/ })
    .first()
    .click()
  // Wait past the SDK's batch interval so anything captured would have been delivered.
  await page.waitForTimeout(5000)

  // Events captured before the revoke may still arrive in the next batch; what matters is
  // that nothing is *captured* after it (judged by the SDK's own event timestamp).
  const capturedAfterRevoke = capture.events.filter((e) => {
    const ts = Date.parse(String((e as unknown as { timestamp?: string }).timestamp ?? ''))
    return Number.isFinite(ts) && ts > revokedAt
  })
  expect(capturedAfterRevoke).toEqual([])
  expect(
    capture.events.some((e) => String(e.properties.$current_url).includes('/curriculum')),
  ).toBe(false)
})
