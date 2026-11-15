import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { env } from '../env.js'
import { safeEqual } from '../security/tokens.js'

// Field order from Paymob "HMAC Transaction Callback" docs (processed/POST callback).
export const TRANSACTION_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const paymobTransactionSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    amount_cents: z.union([z.number(), z.string()]),
    currency: z.string(),
    success: z.boolean(),
    pending: z.boolean(),
    is_refunded: z.boolean().optional().default(false),
    is_voided: z.boolean().optional().default(false),
    is_refund: z.boolean().optional().default(false),
    is_void: z.boolean().optional().default(false),
    created_at: scalar.optional(),
    order: z
      .object({
        id: z.union([z.number(), z.string()]),
        merchant_order_id: z.union([z.string(), z.number(), z.null()]).optional(),
      })
      .passthrough(),
    data: z.object({ message: scalar.optional() }).passthrough().optional(),
  })
  .passthrough()

export type PaymobTransaction = z.infer<typeof paymobTransactionSchema>

export const paymobCallbackSchema = z.object({
  type: z.string(),
  obj: z.record(z.string(), z.unknown()),
})

function readPath(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function hmacValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function transactionHmacString(obj: Record<string, unknown>): string {
  return TRANSACTION_HMAC_FIELDS.map((field) => hmacValue(readPath(obj, field))).join('')
}

export function computeTransactionHmac(obj: Record<string, unknown>, secret: string): string {
  return createHmac('sha512', secret).update(transactionHmacString(obj)).digest('hex')
}

export function verifyTransactionHmac(
  obj: Record<string, unknown>,
  received: unknown,
  secret: string,
): boolean {
  if (typeof received !== 'string' || !/^[a-f0-9]{128}$/i.test(received)) return false
  return safeEqual(computeTransactionHmac(obj, secret), received.toLowerCase())
}

export class PaymobError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
  }
}

type Fetch = typeof fetch
let fetchImpl: Fetch = (...args) => fetch(...args)

export function setPaymobFetch(next: Fetch) {
  fetchImpl = next
}

const REQUEST_TIMEOUT_MS = 15_000

async function request(path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetchImpl(new URL(path, env.PAYMOB_BASE_URL), {
      ...init,
      signal: controller.signal,
    })
    const body = (await res.json().catch(() => null)) as unknown
    if (!res.ok) throw new PaymobError(`Paymob request failed (${res.status})`, res.status)
    return body
  } catch (error) {
    if (error instanceof PaymobError) throw error
    throw new PaymobError('Paymob request failed (network)')
  } finally {
    clearTimeout(timer)
  }
}

export interface PaymobConfigStatus {
  configured: boolean
  mode: 'test' | 'live' | 'unknown'
  missing: string[]
  liveBlocked: boolean
}

export function paymobStatus(): PaymobConfigStatus {
  const missing: string[] = []
  if (!env.PAYMOB_SECRET_KEY) missing.push('PAYMOB_SECRET_KEY')
  if (!env.PAYMOB_PUBLIC_KEY) missing.push('PAYMOB_PUBLIC_KEY')
  if (!env.PAYMOB_HMAC_SECRET) missing.push('PAYMOB_HMAC_SECRET')
  if (env.PAYMOB_INTEGRATION_IDS.length === 0) missing.push('PAYMOB_INTEGRATION_IDS')
  if (!env.API_PUBLIC_URL) missing.push('API_PUBLIC_URL')

  const keys = `${env.PAYMOB_SECRET_KEY ?? ''} ${env.PAYMOB_PUBLIC_KEY ?? ''}`
  const mode = keys.includes('_live_') ? 'live' : keys.includes('_test_') ? 'test' : 'unknown'
  const liveBlocked = mode === 'live' && !env.PAYMOB_ALLOW_LIVE
  return { configured: missing.length === 0 && !liveBlocked, mode, missing, liveBlocked }
}

const intentionResponseSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    client_secret: z.string().min(1),
    intention_order_id: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

export interface IntentionInput {
  amountCents: number
  currency: 'EGP'
  specialReference: string
  itemName: string
  billing: { firstName: string; lastName: string; email: string; phoneNumber: string }
  notificationUrl: string
  redirectionUrl: string
}

export interface Intention {
  intentionId: string
  clientSecret: string
  paymobOrderId: string | null
  checkoutUrl: string
}

export async function createIntention(input: IntentionInput): Promise<Intention> {
  const body = {
    amount: input.amountCents,
    currency: input.currency,
    payment_methods: env.PAYMOB_INTEGRATION_IDS,
    items: [{ name: input.itemName, amount: input.amountCents, quantity: 1 }],
    billing_data: {
      first_name: input.billing.firstName,
      last_name: input.billing.lastName,
      email: input.billing.email,
      phone_number: input.billing.phoneNumber,
    },
    special_reference: input.specialReference,
    notification_url: input.notificationUrl,
    redirection_url: input.redirectionUrl,
  }
  const raw = await request('/v1/intention/', {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.PAYMOB_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const parsed = intentionResponseSchema.safeParse(raw)
  if (!parsed.success) throw new PaymobError('Unexpected Paymob intention response')

  const url = new URL('/unifiedcheckout/', env.PAYMOB_BASE_URL)
  url.searchParams.set('publicKey', env.PAYMOB_PUBLIC_KEY ?? '')
  url.searchParams.set('clientSecret', parsed.data.client_secret)
  return {
    intentionId: String(parsed.data.id),
    clientSecret: parsed.data.client_secret,
    paymobOrderId:
      parsed.data.intention_order_id === undefined ? null : String(parsed.data.intention_order_id),
    checkoutUrl: url.toString(),
  }
}

const authTokenSchema = z.object({ token: z.string().min(1) }).passthrough()

export async function inquireByMerchantOrderId(
  merchantOrderId: string,
): Promise<PaymobTransaction | null> {
  if (!env.PAYMOB_API_KEY) throw new PaymobError('PAYMOB_API_KEY is required for reconciliation')
  const auth = authTokenSchema.safeParse(
    await request('/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: env.PAYMOB_API_KEY }),
    }),
  )
  if (!auth.success) throw new PaymobError('Unexpected Paymob auth response')

  try {
    const raw = await request('/api/ecommerce/orders/transaction_inquiry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.data.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_order_id: merchantOrderId }),
    })
    const parsed = paymobTransactionSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (error instanceof PaymobError && error.status === 404) return null
    throw error
  }
}
