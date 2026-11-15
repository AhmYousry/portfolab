import { Router } from 'express'
import { checkoutSessionSchema, idSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { errors, ok, param, parse, requireUser } from '../http.js'
import { authLimiter } from '../security/rate-limit.js'
import { PaymobError } from '../services/paymob.js'
import { checkoutAvailability, reconcilePurchase, startCheckout } from '../services/payments.js'

const RECONCILE_AFTER_MS = 60_000

export const checkoutRouter = Router()

checkoutRouter.get('/checkout/availability', async (_req, res) => {
  ok(res, await checkoutAvailability())
})

checkoutRouter.post('/checkout/session', authLimiter, async (req, res) => {
  const viewer = requireUser(req)
  const input = parse(checkoutSessionSchema, req.body)
  const result = await startCheckout({ id: viewer.id, email: viewer.email }, input)
  ok(res, result, undefined, 201)
})

checkoutRouter.get('/checkout/status/:purchaseId', authLimiter, async (req, res) => {
  const viewer = requireUser(req)
  const purchaseId = parse(idSchema, param(req, 'purchaseId'))
  let purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, userId: viewer.id } })
  if (!purchase) throw errors.notFound('الطلب مش موجود')

  const refresh = req.query.refresh === '1'
  const oldEnough = Date.now() - purchase.createdAt.getTime() > RECONCILE_AFTER_MS
  if (refresh && purchase.status === 'PENDING' && oldEnough && env.PAYMOB_API_KEY) {
    try {
      await reconcilePurchase(purchase.id)
    } catch (error) {
      if (!(error instanceof PaymobError)) throw error
    }
    purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })
  }

  ok(res, {
    purchase: {
      id: purchase.id,
      status: purchase.status,
      amountMinor: purchase.amountMinor,
      currency: purchase.currency,
      createdAt: purchase.createdAt,
      paidAt: purchase.paidAt,
    },
  })
})
