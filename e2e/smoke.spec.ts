import { type Page, expect, test } from '@playwright/test'

const PASSWORD = 'e2e-only-password-123'

async function dismissConsent(page: Page) {
  const decline = page.getByRole('button', { name: 'لأ، شكرًا' })
  if (await decline.isVisible().catch(() => false)) await decline.click()
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('anonymous visitor', () => {
  test('landing is RTL Arabic with a free CTA', async ({ page }) => {
    await page.goto('/?utm_source=instagram&utm_campaign=e2e')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ابدأ تبني')
    await expect(page.getByRole('link', { name: /ابدأ TaskFlow Lite مجانًا/ })).toBeVisible()
  })

  test('Portfolab branding: title, logo, OG metadata, manifest', async ({ page, request }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Portfolab — Build Real Projects. Prove Your Skills.')
    await expect(page.getByRole('link', { name: /Portfolab/ }).first()).toBeVisible()
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'Portfolab',
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      '/og-image.png',
    )
    const manifest = await request.get('/site.webmanifest')
    expect((await manifest.json()).short_name).toBe('Portfolab')
    await dismissConsent(page)
    await page.goto('/pricing')
    await expect(page).toHaveTitle('الأسعار · Portfolab')
  })

  test('analytics consent: nothing loads before choice, choice persists, settings reopen', async ({
    page,
  }) => {
    const posthogRequests: string[] = []
    page.on('request', (r) => {
      if (/posthog/i.test(r.url())) posthogRequests.push(r.url())
    })
    await page.goto('/')
    await expect(page.getByTestId('consent-banner')).toBeVisible()
    await page.getByRole('button', { name: 'لأ، شكرًا' }).click()
    await expect(page.getByTestId('consent-banner')).toBeHidden()
    await page.reload()
    await expect(page.getByTestId('consent-banner')).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('pb_analytics_consent'))).toContain(
      '"analytics":false',
    )
    await page.getByRole('button', { name: 'إعدادات التحليلات' }).click()
    await expect(page.getByTestId('consent-banner')).toBeVisible()
    expect(posthogRequests).toEqual([])
  })

  test('pricing shows Pro as coming soon with checkout disabled', async ({ page }) => {
    await page.goto('/pricing')
    await dismissConsent(page)
    await expect(page.getByRole('heading', { name: 'Portfolab Pro' })).toBeVisible()
    await expect(page.getByRole('button', { name: /الدفع مش متاح لسه/ })).toBeDisabled()
    await expect(page.getByText('ExpensePilot · قريبًا')).toBeVisible()
  })

  test('checkout page stays closed while payments are not enabled', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/)
  })

  test('preview lesson is readable and code stays LTR; other lessons ask for signup', async ({
    page,
  }) => {
    await page.goto('/projects/taskflow-lite/lessons/why-taskflow')
    await dismissConsent(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('TaskFlow Lite')
    await expect(page.locator('pre').first()).toHaveAttribute('dir', 'ltr')

    await page.goto('/projects/taskflow-lite/lessons/crud-endpoints')
    await expect(page.getByRole('heading', { name: 'الدرس ده محتاج حساب مجاني' })).toBeVisible()
  })

  test('health endpoint is JSON, not the SPA', async ({ request }) => {
    const res = await request.get('http://localhost:4000/api/health')
    expect(res.headers()['content-type']).toContain('application/json')
    expect((await res.json()).data.status).toBe('ok')
  })
})

test('student: signup → enroll → checkpoint → progress survives logout/login', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`

  await page.goto('/signup')
  await dismissConsent(page)
  await page.getByLabel('اسمك').fill('E2E Student')
  await page.getByLabel('الإيميل', { exact: true }).fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'اعمل حساب' }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('هدفك').selectOption('PORTFOLIO')
  await page.getByRole('button', { name: 'احفظ وكمّل' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto('/projects/taskflow-lite')
  await page.getByRole('button', { name: 'ابدأ المشروع' }).click()
  await expect(page).toHaveURL(/lessons\/why-taskflow/)

  const checkpoint = page.getByRole('checkbox', { name: /كتبت 5 user stories/ })
  // Controlled input: the optimistic update lands after an awaited cancelQueries, so .check()'s
  // immediate state assertion races it. Click, then wait for the checked state.
  await checkpoint.click()
  await expect(checkpoint).toBeChecked()
  await expect(page.getByText('1 من 2')).toBeVisible()

  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/login')
  await page.getByLabel('الإيميل', { exact: true }).fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'دخول' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('الخطوة الجاية')).toBeVisible()

  await page.goto('/projects/taskflow-lite/lessons/why-taskflow')
  await expect(page.getByRole('checkbox', { name: /كتبت 5 user stories/ })).toBeChecked()

  await page.goto('/admin')
  await expect(page.getByText('الصفحة دي للأدمن بس.')).toBeVisible()

  await page.goto(
    '/checkout/status?purchase=cmnotreal12345&id=192036465&source_data.pan=2346&source_data.sub_type=MasterCard&hmac=abc',
  )
  await expect(page).toHaveURL(/\/checkout\/status\?purchase=cmnotreal12345$/)
})

test('admin: overview, content tree and lesson preview', async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  test.skip(!email || !password, 'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set')

  await page.goto('/login?next=/admin')
  await dismissConsent(page)
  await page.getByLabel('الإيميل', { exact: true }).fill(email ?? '')
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password ?? '')
  await page.getByRole('button', { name: 'دخول' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('purchase_confirmed')).toBeVisible()

  await page.getByRole('link', { name: 'المحتوى' }).click()
  await expect(page.getByRole('heading', { name: 'ExpensePilot' })).toBeVisible()
  await page.getByRole('link', { name: 'معاينة' }).first().click()
  await expect(page.getByText('معاينة أدمن')).toBeVisible()

  await page.getByRole('link', { name: 'الطلبات' }).click()
  await expect(page.getByText('الدفع مش متفعل')).toBeVisible()
})

test('mobile layout has no horizontal scroll @mobile', async ({ page }) => {
  for (const path of [
    '/',
    '/pricing',
    '/projects/taskflow-lite',
    '/projects/taskflow-lite/lessons/why-taskflow',
  ]) {
    await page.goto(path)
    await dismissConsent(page)
    await expectNoHorizontalScroll(page)
  }
  await page.getByRole('button', { name: 'افتح القائمة' }).click()
  await expect(page.getByRole('link', { name: 'الأسعار' })).toBeVisible()
})
