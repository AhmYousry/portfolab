import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'
import {
  computeTransactionHmac,
  setPaymobFetch,
  transactionHmacString,
  verifyTransactionHmac,
} from '../src/services/paymob.js'
import { setAnalyticsSink } from '../src/services/product-analytics.js'
import { app, createPublishedProProject, resetDb, seedContent, signedUpClient } from './helpers.js'

const HMAC_SECRET = 'test-hmac-secret-not-real'
const ORIGINAL = { ...env }
const BILLING = { firstName: 'Test', lastName: 'Student', phoneNumber: '+201000000000' }

interface Captured {
  distinctId: string
  event: string
  properties: Record<string, string | number | boolean>
}
const captured: Captured[] = []
const fetchCalls: { url: string; init: RequestInit }[] = []
let intentionOk = true
let intentionCounter = 0

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let inquiryTx: Record<string, unknown> | null = null

beforeAll(async () => {
  await resetDb()
  await seedContent()
  await createPublishedProProject()
  Object.assign(env, {
    CHECKOUT_ENABLED: true,
    API_PUBLIC_URL: 'https://api.portfolab.test',
    PAYMOB_SECRET_KEY: 'sk_test_fake',
    PAYMOB_PUBLIC_KEY: 'pk_test_fake',
    PAYMOB_HMAC_SECRET: HMAC_SECRET,
    PAYMOB_API_KEY: 'legacy_fake',
    PAYMOB_INTEGRATION_IDS: [111],
    PAYMOB_ALLOW_LIVE: false,
  })
  setAnalyticsSink({
    capture: (distinctId, event, properties) =>
      void captured.push({ distinctId, event, properties }),
    shutdown: async () => undefined,
  })
  setPaymobFetch(async (input, init) => {
    const url = String(input)
    fetchCalls.push({ url, init: init ?? {} })
    if (url.endsWith('/v1/intention/')) {
      if (!intentionOk) return jsonResponse(500, { detail: 'boom' })
      intentionCounter += 1
      return jsonResponse(201, {
        id: `pi_test_${intentionCounter}`,
        client_secret: `csk_test_${intentionCounter}`,
        intention_order_id: 900000 + intentionCounter,
      })
    }
    if (url.endsWith('/api/auth/tokens')) return jsonResponse(201, { token: 'auth_tok' })
    if (url.endsWith('/api/ecommerce/orders/transaction_inquiry')) {
      return inquiryTx ? jsonResponse(200, inquiryTx) : jsonResponse(404, { detail: 'not found' })
    }
    return jsonResponse(404, {})
  })
})

afterAll(() => {
  Object.assign(env, ORIGINAL)
})

beforeEach(() => {
  captured.length = 0
  fetchCalls.length = 0
  intentionOk = true
  inquiryTx = null
})

let txCounter = 1000

function transaction(purchaseId: string, overrides: Record<string, unknown> = {}) {
  txCounter += 1
  return {
    id: txCounter,
    amount_cents: 24900,
    created_at: '2026-11-15T12:00:00.000000',
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    integration_id: 111,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    owner: 42,
    pending: false,
    success: true,
    source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
    order: { id: 987654, merchant_order_id: purchaseId },
    data: { message: 'Approved' },
    ...overrides,
  }
}

function postWebhook(
  obj: Record<string, unknown>,
  hmac = computeTransactionHmac(obj, HMAC_SECRET),
  type = 'TRANSACTION',
) {
  return request(app).post(`/api/webhooks/payments/paymob?hmac=${hmac}`).send({ type, obj })
}

async function consentingStudent() {
  const s = await signedUpClient()
  await s.client.put('/api/me/analytics-consent', { analytics: true })
  return s
}

async function startCheckout() {
  const s = await consentingStudent()
  const res = await s.client.post('/api/checkout/session', BILLING)
  expect(res.status).toBe(201)
  return {
    ...s,
    purchaseId: res.body.data.purchaseId as string,
    checkoutUrl: res.body.data.checkoutUrl as string,
  }
}

describe('Paymob HMAC', () => {
  it('concatenates fields in the documented order (Paymob docs sample)', () => {
    const sample = {
      amount_cents: 100000,
      created_at: '2024-06-13T11:33:44.592345',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      id: 192036465,
      integration_id: 4097558,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 217503754 },
      owner: 302852,
      pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      success: true,
    }
    expect(transactionHmacString(sample)).toBe(
      '1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue',
    )
  })

  it('rejects tampered payloads and malformed signatures', () => {
    const obj = transaction('p1')
    const hmac = computeTransactionHmac(obj, HMAC_SECRET)
    expect(verifyTransactionHmac(obj, hmac, HMAC_SECRET)).toBe(true)
    expect(verifyTransactionHmac({ ...obj, amount_cents: 1 }, hmac, HMAC_SECRET)).toBe(false)
    expect(verifyTransactionHmac(obj, hmac, 'other-secret')).toBe(false)
    expect(verifyTransactionHmac(obj, undefined, HMAC_SECRET)).toBe(false)
    expect(verifyTransactionHmac(obj, 'abc', HMAC_SECRET)).toBe(false)
  })
})

describe('checkout availability', () => {
  it('stays closed when Paymob is not configured', async () => {
    const saved = env.PAYMOB_SECRET_KEY
    env.PAYMOB_SECRET_KEY = undefined
    const res = await request(app).get('/api/checkout/availability')
    expect(res.body.data).toMatchObject({ enabled: false, blockers: ['PROVIDER_NOT_CONFIGURED'] })
    env.PAYMOB_SECRET_KEY = saved
  })

  it('refuses live keys unless explicitly allowed', async () => {
    env.PAYMOB_SECRET_KEY = 'sk_live_fake'
    const res = await request(app).get('/api/checkout/availability')
    expect(res.body.data.blockers).toContain('PROVIDER_NOT_CONFIGURED')
    env.PAYMOB_SECRET_KEY = 'sk_test_fake'
  })

  it('is open when enabled, configured and Pro content is published', async () => {
    const res = await request(app).get('/api/checkout/availability')
    expect(res.body.data).toEqual({ enabled: true, blockers: [] })
    const pricing = await request(app).get('/api/pricing')
    expect(pricing.body.data.tiers[1]).toMatchObject({
      name: 'Portfolab Pro',
      checkoutEnabled: true,
      priceMinor: 24900,
    })
  })
})

describe('checkout session', () => {
  it('requires login and CSRF', async () => {
    expect((await request(app).post('/api/checkout/session').send(BILLING)).status).toBe(403)
    const { Client } = await import('./helpers.js')
    const anon = await new Client().init()
    expect((await anon.post('/api/checkout/session', BILLING)).status).toBe(401)
  })

  it('validates input and never accepts a client-supplied amount', async () => {
    const { client } = await consentingStudent()
    expect(
      (await client.post('/api/checkout/session', { ...BILLING, phoneNumber: 'call me' })).status,
    ).toBe(400)
    expect((await client.post('/api/checkout/session', { ...BILLING, amount: 1 })).status).toBe(400)
  })

  it('creates a pending purchase and a server-priced Paymob intention', async () => {
    const { purchaseId, checkoutUrl, userId } = await startCheckout()
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })
    expect(purchase).toMatchObject({
      status: 'PENDING',
      amountMinor: 24900,
      currency: 'EGP',
      provider: 'paymob',
    })
    expect(purchase.intentionId).toBe(`pi_test_${intentionCounter}`)
    expect(purchase.providerOrderId).toBe(String(900000 + intentionCounter))

    const call = fetchCalls.find((c) => c.url.endsWith('/v1/intention/'))
    expect(call?.url).toBe('https://accept.paymob.com/v1/intention/')
    expect((call?.init.headers as Record<string, string>).Authorization).toBe('Token sk_test_fake')
    const body = JSON.parse(String(call?.init.body))
    expect(body).toMatchObject({
      amount: 24900,
      currency: 'EGP',
      payment_methods: [111],
      special_reference: purchaseId,
      notification_url: 'https://api.portfolab.test/api/webhooks/payments/paymob',
    })
    expect(body.redirection_url).toContain(`/checkout/status?purchase=${purchaseId}`)

    const url = new URL(checkoutUrl)
    expect(url.origin + url.pathname).toBe('https://accept.paymob.com/unifiedcheckout/')
    expect(url.searchParams.get('publicKey')).toBe('pk_test_fake')
    expect(url.searchParams.get('clientSecret')).toBe(`csk_test_${intentionCounter}`)

    expect(captured).toEqual([
      expect.objectContaining({
        distinctId: userId,
        event: 'checkout_started',
        properties: expect.objectContaining({ plan: 'pro' }),
      }),
    ])
  })

  it('marks the purchase failed and reports checkout_failed when Paymob errors', async () => {
    const { client, userId } = await consentingStudent()
    intentionOk = false
    const res = await client.post('/api/checkout/session', BILLING)
    expect(res.status).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('sk_test_fake')
    const purchase = await prisma.purchase.findFirstOrThrow({ where: { userId } })
    expect(purchase).toMatchObject({ status: 'FAILED', failureReason: 'intention_failed' })
    expect(captured.map((c) => c.event)).toEqual(['checkout_failed'])
  })
})

describe('Paymob webhook', () => {
  it('rejects forged or missing signatures without changing state', async () => {
    const { purchaseId } = await startCheckout()
    const obj = transaction(purchaseId)
    expect((await postWebhook(obj, 'f'.repeat(128))).status).toBe(401)
    expect(
      (await request(app).post('/api/webhooks/payments/paymob').send({ type: 'TRANSACTION', obj }))
        .status,
    ).toBe(401)
    const forgedAmount = { ...obj, amount_cents: 1 }
    expect((await postWebhook(forgedAmount, computeTransactionHmac(obj, HMAC_SECRET))).status).toBe(
      401,
    )
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe(
      'PENDING',
    )
    expect(await prisma.entitlement.count({ where: { purchaseId } })).toBe(0)
  })

  it('grants Pro once on a verified success and dedupes repeated deliveries', async () => {
    const { purchaseId, userId, client } = await startCheckout()
    captured.length = 0
    const obj = transaction(purchaseId)

    const first = await postWebhook(obj)
    expect(first.body.data).toEqual({ outcome: 'paid' })
    const again = await postWebhook(obj)
    expect(again.body.data).toEqual({ duplicate: true })

    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })
    expect(purchase).toMatchObject({ status: 'PAID', providerTransactionId: String(obj.id) })
    expect(purchase.analyticsCapturedAt).not.toBeNull()
    expect(await prisma.entitlement.count({ where: { userId, revokedAt: null } })).toBe(1)

    const me = await client.get('/api/auth/me')
    expect(me.body.data.user.hasPro).toBe(true)
    expect((await client.get('/api/projects/pro-fixture/lessons/paid-lesson')).status).toBe(200)

    const purchaseEvents = captured.filter((c) => c.event === 'purchase_completed')
    expect(purchaseEvents).toHaveLength(1)
    expect(purchaseEvents[0]).toMatchObject({
      distinctId: userId,
      properties: {
        plan: 'pro',
        amount_egp: 249,
        currency: 'EGP',
        provider: 'paymob',
        purchase_id: purchaseId,
      },
    })
    expect(JSON.stringify(captured)).not.toMatch(/@example\.test|2346|MasterCard/)

    const status = await client.get(`/api/checkout/status/${purchaseId}`)
    expect(status.body.data.purchase.status).toBe('PAID')
  })

  it('a second success transaction for the same order does not double-grant or double-count', async () => {
    const { purchaseId, userId } = await startCheckout()
    await postWebhook(transaction(purchaseId))
    const res = await postWebhook(transaction(purchaseId))
    expect(res.body.data).toEqual({ outcome: 'already_paid' })
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(1)
    expect(captured.filter((c) => c.event === 'purchase_completed')).toHaveLength(1)
  })

  it('does not grant access when the amount or currency does not match', async () => {
    const { purchaseId, userId } = await startCheckout()
    const res = await postWebhook(transaction(purchaseId, { amount_cents: 100 }))
    expect(res.body.data).toEqual({ outcome: 'amount_mismatch' })
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(0)
    const usd = await postWebhook(transaction(purchaseId, { currency: 'USD' }))
    expect(usd.body.data).toEqual({ outcome: 'amount_mismatch' })
  })

  it('records failed payments without access, and a later success still works', async () => {
    const { purchaseId, userId } = await startCheckout()
    captured.length = 0
    const failed = await postWebhook(
      transaction(purchaseId, { success: false, data: { message: 'Insufficient funds' } }),
    )
    expect(failed.body.data).toEqual({ outcome: 'failed' })
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe(
      'FAILED',
    )
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(0)
    expect(captured.map((c) => c.event)).toEqual(['checkout_failed'])

    const retry = await postWebhook(transaction(purchaseId))
    expect(retry.body.data).toEqual({ outcome: 'paid' })
  })

  it('pending transactions change nothing', async () => {
    const { purchaseId } = await startCheckout()
    const res = await postWebhook(transaction(purchaseId, { pending: true, success: false }))
    expect(res.body.data).toEqual({ outcome: 'pending' })
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe(
      'PENDING',
    )
  })

  it('refund revokes Pro access', async () => {
    const { purchaseId, userId, client } = await startCheckout()
    const paid = transaction(purchaseId)
    await postWebhook(paid)
    const refund = await postWebhook({ ...paid, is_refunded: true })
    expect(refund.body.data).toEqual({ outcome: 'refunded' })
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })
    expect(purchase.status).toBe('REFUNDED')
    expect(purchase.refundedAt).not.toBeNull()
    expect(await prisma.entitlement.count({ where: { userId, revokedAt: null } })).toBe(0)
    expect((await client.get('/api/projects/pro-fixture/lessons/paid-lesson')).status).toBe(403)
    expect(
      await prisma.auditLog.count({
        where: { objectId: purchaseId, action: 'entitlement.revoke' },
      }),
    ).toBe(1)

    const stale = await postWebhook(transaction(purchaseId))
    expect(stale.body.data).toEqual({ outcome: 'ignored_stale' })
    expect(await prisma.entitlement.count({ where: { userId, revokedAt: null } })).toBe(0)
  })

  it('unknown orders are acknowledged and recorded as rejected', async () => {
    const res = await postWebhook(
      transaction('does-not-exist', { order: { id: 1, merchant_order_id: 'does-not-exist' } }),
    )
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ outcome: 'unknown_order' })
    const rejected = await prisma.webhookEvent.count({ where: { processingStatus: 'REJECTED' } })
    expect(rejected).toBeGreaterThan(0)
  })

  it('ignores non-transaction callbacks and stores only a digest of the payload', async () => {
    const res = await request(app)
      .post('/api/webhooks/payments/paymob')
      .send({ type: 'TOKEN', obj: { token: 'x' } })
    expect(res.body.data).toEqual({ ignored: true })
    const event = await prisma.webhookEvent.findFirstOrThrow()
    expect(event.payloadDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.keys(event)).not.toContain('payload')
  })

  it('status endpoint is owner-only', async () => {
    const { purchaseId } = await startCheckout()
    const other = await signedUpClient()
    expect((await other.client.get(`/api/checkout/status/${purchaseId}`)).status).toBe(404)
  })
})

describe('reconciliation', () => {
  it('a missed webhook is recovered via transaction inquiry, with one purchase event', async () => {
    const { purchaseId, userId, client } = await startCheckout()
    captured.length = 0
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    })
    inquiryTx = transaction(purchaseId)

    const status = await client.get(`/api/checkout/status/${purchaseId}?refresh=1`)
    expect(status.body.data.purchase.status).toBe('PAID')
    expect(await prisma.entitlement.count({ where: { userId, revokedAt: null } })).toBe(1)
    const tokenCall = fetchCalls.find((c) => c.url.endsWith('/api/auth/tokens'))
    expect(JSON.parse(String(tokenCall?.init.body))).toEqual({ api_key: 'legacy_fake' })

    await postWebhook(inquiryTx)
    expect(captured.filter((c) => c.event === 'purchase_completed')).toHaveLength(1)
  })
})

describe('server-side analytics consent', () => {
  it('sends nothing for users who did not consent, but still provisions access', async () => {
    const s = await signedUpClient()
    const res = await s.client.post('/api/checkout/session', BILLING)
    const purchaseId = res.body.data.purchaseId as string
    await postWebhook(transaction(purchaseId))
    expect(captured.filter((c) => c.distinctId === s.userId)).toEqual([])
    expect(await prisma.entitlement.count({ where: { userId: s.userId, revokedAt: null } })).toBe(1)
  })

  it('emits lesson_completed and project_completed once for consenting learners', async () => {
    const { client, userId } = await consentingStudent()
    captured.length = 0
    const lessons = await prisma.lesson.findMany({
      where: { module: { project: { slug: 'taskflow-lite' } } },
      include: { checkpoints: true },
    })
    for (const lesson of lessons) {
      for (const cp of lesson.checkpoints)
        await client.put(`/api/checkpoints/${cp.id}/progress`, { status: 'COMPLETED' })
    }
    const mine = captured.filter((c) => c.distinctId === userId)
    expect(mine.filter((c) => c.event === 'lesson_completed')).toHaveLength(lessons.length)
    expect(mine.filter((c) => c.event === 'free_project_started')).toHaveLength(1)
    expect(mine.filter((c) => c.event === 'project_completed')).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({ project_id: 'taskflow-lite', plan: 'free' }),
      }),
    ])

    const first = lessons[0]?.checkpoints[0]
    if (!first) throw new Error('fixture')
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'NOT_STARTED' })
    await client.put(`/api/checkpoints/${first.id}/progress`, { status: 'COMPLETED' })
    expect(
      captured.filter((c) => c.distinctId === userId && c.event === 'project_completed'),
    ).toHaveLength(1)
  })

  it('consent endpoint validates input and is reflected on /me', async () => {
    const { client } = await signedUpClient()
    expect((await client.put('/api/me/analytics-consent', { analytics: 'yes' })).status).toBe(400)
    await client.put('/api/me/analytics-consent', { analytics: true })
    expect((await client.get('/api/auth/me')).body.data.user.analyticsConsent).toBe(true)
  })
})

describe('admin metrics', () => {
  it('reports revenue and conversion only from verified PAID purchases', async () => {
    const { client, userId } = await signedUpClient()
    await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } })
    const res = await client.get('/api/admin/overview')
    expect(res.status).toBe(200)
    const m = res.body.data.metrics
    const paid = await prisma.purchase.aggregate({
      where: { status: 'PAID' },
      _sum: { amountMinor: true },
      _count: true,
    })
    expect(m.confirmedPurchases).toBe(paid._count)
    expect(m.revenueMinor).toBe(paid._sum.amountMinor ?? 0)
    expect(m.currency).toBe('EGP')
    expect(m.refundedPurchases).toBeGreaterThanOrEqual(1)
    expect(res.body.data.paymob).toMatchObject({ mode: 'test', configured: true })
    expect(JSON.stringify(res.body)).not.toContain('sk_test_fake')
  })
})
