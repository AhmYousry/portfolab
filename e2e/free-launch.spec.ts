import { type Page, expect, test } from '@playwright/test'

const FREE_PROJECT_URL = /\/projects\/taskflow-lite$/
const UNAVAILABLE = 'المحتوى ده مش متاح في البيتا المجانية'

async function dismissConsent(page: Page) {
  const decline = page.getByRole('button', { name: 'لأ، شكرًا' })
  if (await decline.isVisible().catch(() => false)) await decline.click()
}

test('free launch: TaskFlow Lite only, no pricing, commerce deep links redirect', async ({
  page,
}) => {
  await page.goto('/')
  await dismissConsent(page)
  await expect(page.getByRole('link', { name: /ابدأ TaskFlow Lite مجانًا/ })).toBeVisible()

  const mainNav = page.getByRole('navigation', { name: 'القائمة الرئيسية' })
  await expect(mainNav.getByRole('link', { name: 'المنهج' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'الأسعار' })).toHaveCount(0)
  const footerNav = page.getByRole('navigation', { name: 'روابط قانونية' })
  await expect(footerNav.getByRole('link', { name: 'الخصوصية' })).toBeVisible()
  await expect(footerNav.getByRole('link', { name: 'الاسترجاع' })).toHaveCount(0)

  for (const path of [
    '/pricing',
    '/checkout',
    '/checkout/status?purchase=cmnotreal12345&hmac=abc',
    '/refund-policy',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(FREE_PROJECT_URL)
  }
  await expect(page.getByRole('heading', { level: 1 })).toContainText('TaskFlow Lite')

  await page.goto('/curriculum')
  await expect(page.getByRole('heading', { name: 'TaskFlow Lite', level: 3 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ExpensePilot' })).toHaveCount(0)

  await page.goto('/projects/expensepilot')
  await expect(page.getByRole('heading', { name: UNAVAILABLE })).toBeVisible()
  await page.goto('/projects/expensepilot/lessons/product-scope')
  await expect(page.getByRole('heading', { name: UNAVAILABLE })).toBeVisible()

  await page.goto('/projects/taskflow-lite/lessons/why-taskflow')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('TaskFlow Lite')

  await page.goto('/signup')
  await expect(page.getByLabel('الإيميل', { exact: true })).toBeVisible()
})
