import { Prisma } from '@prisma/client'
import { BRAND } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { HttpError, errors } from '../http.js'
import {
  type PaymobTransaction,
  PaymobError,
  createIntention,
  inquireByMerchantOrderId,
  paymobStatus,
} from './paymob.js'
import { claimOnce } from './analytics-claims.js'
import { captureForUser } from './product-analytics.js'

export const PRO_PRICE_MINOR = 24900
export const CURRENCY = 'EGP'
export const PROVIDER = 'paymob'
const MINOR_PER_EGP = 100
const REASON_MAX = 120
const STALE_PENDING_HOURS = 24
const HOUR_MS = 60 * 60 * 1000

export type CheckoutBlocker = 'DISABLED' | 'PROVIDER_NOT_CONFIGURED' | 'NO_PRO_CONTENT'

export async function checkoutAvailability(): Promise<{
  enabled: boolean
  blockers: CheckoutBlocker[]
}> {
  const blockers: CheckoutBlocker[] = []
  if (!env.CHECKOUT_ENABLED) blockers.push('DISABLED')
  if (!paymobStatus().configured) blockers.push('PROVIDER_NOT_CONFIGURED')
  const publishedPro = await prisma.project.count({ where: { tier: 'PRO', status: 'PUBLISHED' } })
  if (publishedPro === 0) blockers.push('NO_PRO_CONTENT')
  return { enabled: blockers.length === 0, blockers }
}

function log(purchaseId: string, message: string) {
  console.info(`[payments] purchase=${purchaseId} ${message}`)
}

export interface CheckoutInput {
  firstName: string
  lastName: string
  phoneNumber: string
  source: string
}

export async function startCheckout(user: { id: string; email: string }, input: CheckoutInput) {
  const availability = await checkoutAvailability()
  if (!availability.enabled) {
    throw new HttpError(409, 'CHECKOUT_UNAVAILABLE', 'الدفع مش متاح دلوقتي.', {
      blockers: availability.blockers,
    })
  }
  const active = await prisma.entitlement.count({
    where: { userId: user.id, tier: 'PRO', revokedAt: null },
  })
  if (active > 0) throw errors.conflict('عندك Pro بالفعل.')

  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      provider: PROVIDER,
      status: 'PENDING',
      amountMinor: PRO_PRICE_MINOR,
      currency: CURRENCY,
    },
  })

  try {
    const intention = await createIntention({
      amountCents: PRO_PRICE_MINOR,
      currency: CURRENCY,
      specialReference: purchase.id,
      itemName: BRAND.proTier,
      billing: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: user.email,
        phoneNumber: input.phoneNumber,
      },
      notificationUrl: new URL('/api/webhooks/payments/paymob', env.API_PUBLIC_URL).toString(),
      redirectionUrl: `${env.APP_URL}/checkout/status?purchase=${encodeURIComponent(purchase.id)}`,
    })
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { intentionId: intention.intentionId, providerOrderId: intention.paymobOrderId },
    })
    log(purchase.id, 'intention created')
    await captureForUser(user.id, 'checkout_started', {
      plan: 'pro',
      source: input.source,
      amount_egp: PRO_PRICE_MINOR / MINOR_PER_EGP,
    })
    return { purchaseId: purchase.id, checkoutUrl: intention.checkoutUrl }
  } catch (error) {
    const reason = error instanceof PaymobError ? 'intention_failed' : 'internal_error'
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: reason },
    })
    log(purchase.id, `intention failed (${reason})`)
    await captureForUser(user.id, 'checkout_failed', { plan: 'pro', source: input.source, reason })
    throw new HttpError(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'مش قادرين نوصل لبوابة الدفع دلوقتي. جرب تاني بعد شوية.',
    )
  }
}

export type TransactionOutcome =
  | 'paid'
  | 'already_paid'
  | 'failed'
  | 'refunded'
  | 'pending'
  | 'ignored_stale'
  | 'unknown_order'
  | 'amount_mismatch'

function isRefundState(tx: PaymobTransaction) {
  return tx.is_refunded || tx.is_voided || tx.is_refund || tx.is_void
}

async function findPurchase(tx: PaymobTransaction) {
  const merchantOrderId = tx.order.merchant_order_id
  if (merchantOrderId !== undefined && merchantOrderId !== null && merchantOrderId !== '') {
    const byRef = await prisma.purchase.findFirst({
      where: { id: String(merchantOrderId), provider: PROVIDER },
    })
    if (byRef) return byRef
  }
  return prisma.purchase.findFirst({
    where: { providerOrderId: String(tx.order.id), provider: PROVIDER },
  })
}

async function grantPro(userId: string, purchaseId: string) {
  try {
    await prisma.entitlement.create({ data: { userId, tier: 'PRO', purchaseId } })
  } catch (error) {
    const duplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    if (!duplicate) throw error
  }
}

async function emitPurchaseCompletedOnce(purchaseId: string, userId: string, amountMinor: number) {
  const claimed = await prisma.purchase.updateMany({
    where: { id: purchaseId, analyticsCapturedAt: null },
    data: { analyticsCapturedAt: new Date() },
  })
  if (claimed.count !== 1) return false
  await captureForUser(
    userId,
    'purchase_completed',
    {
      plan: 'pro',
      amount_egp: amountMinor / MINOR_PER_EGP,
      currency: CURRENCY,
      provider: PROVIDER,
      purchase_id: purchaseId,
    },
    { setPersonProperties: { plan: 'pro' }, flush: true },
  )
  return true
}

async function emitPurchaseRefundedOnce(purchaseId: string, userId: string, amountMinor: number) {
  if (!(await claimOnce('purchase_refunded', userId, purchaseId))) return false
  const stillPro = await prisma.entitlement.count({
    where: { userId, tier: 'PRO', revokedAt: null },
  })
  await captureForUser(
    userId,
    'purchase_refunded',
    {
      plan: 'pro',
      amount_egp: amountMinor / MINOR_PER_EGP,
      currency: CURRENCY,
      provider: PROVIDER,
      purchase_id: purchaseId,
    },
    { setPersonProperties: { plan: stillPro > 0 ? 'pro' : 'free' }, flush: true },
  )
  return true
}

export async function processTransaction(
  tx: PaymobTransaction,
  source: 'webhook' | 'reconcile',
): Promise<TransactionOutcome> {
  const purchase = await findPurchase(tx)
  if (!purchase) return 'unknown_order'
  const txId = String(tx.id)

  if (isRefundState(tx)) {
    const updated = await prisma.purchase.updateMany({
      where: { id: purchase.id, status: 'PAID' },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    if (updated.count === 1) {
      await prisma.entitlement.updateMany({
        where: { purchaseId: purchase.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await prisma.auditLog.create({
        data: {
          action: 'entitlement.revoke',
          objectType: 'purchase',
          objectId: purchase.id,
          detail: { source, reason: 'refund' },
        },
      })
      log(purchase.id, `refunded via ${source}`)
      await emitPurchaseRefundedOnce(purchase.id, purchase.userId, purchase.amountMinor)
      return 'refunded'
    }
    return 'ignored_stale'
  }

  if (tx.pending) return 'pending'

  if (tx.success) {
    if (Number(tx.amount_cents) !== purchase.amountMinor || tx.currency !== purchase.currency) {
      await prisma.purchase.updateMany({
        where: { id: purchase.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { failureReason: 'amount_mismatch' },
      })
      log(purchase.id, `amount mismatch via ${source}; access NOT granted`)
      return 'amount_mismatch'
    }
    if (purchase.status === 'PAID') return 'already_paid'
    if (purchase.status === 'REFUNDED') return 'ignored_stale'

    const updated = await prisma.purchase.updateMany({
      where: { id: purchase.id, status: { in: ['PENDING', 'FAILED'] } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerTransactionId: txId,
        failureReason: null,
      },
    })
    if (updated.count !== 1) return 'already_paid'
    await grantPro(purchase.userId, purchase.id)
    await prisma.auditLog.create({
      data: {
        action: 'entitlement.grant',
        objectType: 'purchase',
        objectId: purchase.id,
        detail: { source, tier: 'PRO' },
      },
    })
    log(purchase.id, `paid via ${source}`)
    await emitPurchaseCompletedOnce(purchase.id, purchase.userId, purchase.amountMinor)
    return 'paid'
  }

  const reason = String(tx.data?.message ?? 'declined').slice(0, REASON_MAX)
  const failed = await prisma.purchase.updateMany({
    where: { id: purchase.id, status: 'PENDING' },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: reason,
      providerTransactionId: txId,
    },
  })
  if (failed.count === 1) {
    log(purchase.id, `failed via ${source}`)
    await captureForUser(purchase.userId, 'checkout_failed', {
      plan: 'pro',
      source: 'paymob',
      reason: 'declined',
    })
    return 'failed'
  }
  return 'ignored_stale'
}

export async function reconcilePurchase(
  purchaseId: string,
): Promise<TransactionOutcome | 'not_found' | 'expired'> {
  const tx = await inquireByMerchantOrderId(purchaseId)
  if (tx) return processTransaction(tx, 'reconcile')
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (
    purchase?.status === 'PENDING' &&
    Date.now() - purchase.createdAt.getTime() > STALE_PENDING_HOURS * HOUR_MS
  ) {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: 'expired_without_payment' },
    })
    return 'expired'
  }
  return 'not_found'
}

export async function reconcilePending(olderThanMinutes: number, limit: number) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000)
  const pending = await prisma.purchase.findMany({
    where: { provider: PROVIDER, status: 'PENDING', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  const results: Record<string, string> = {}
  for (const p of pending) {
    try {
      results[p.id] = await reconcilePurchase(p.id)
    } catch (error) {
      results[p.id] = error instanceof PaymobError ? `error:${error.status ?? 'network'}` : 'error'
    }
  }
  return results
}
