import { Prisma } from '@prisma/client'
import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { sha256 } from '../security/tokens.js'
import {
  paymobCallbackSchema,
  paymobTransactionSchema,
  verifyTransactionHmac,
} from '../services/paymob.js'
import { type TransactionOutcome, processTransaction } from '../services/payments.js'

const WEBHOOK_BODY_LIMIT = '256kb'
const WEBHOOK_RATE_PER_MINUTE = 120
const PROVIDER = 'paymob'
const REJECTED_OUTCOMES = new Set<TransactionOutcome>(['unknown_order', 'amount_mismatch'])

export const webhooksRouter = Router()

webhooksRouter.use(express.json({ limit: WEBHOOK_BODY_LIMIT }))
webhooksRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: WEBHOOK_RATE_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
  }),
)

function reply(res: express.Response, status: number, data: Record<string, unknown>) {
  res.status(status).json({ data, error: null })
}

webhooksRouter.post('/payments/paymob', async (req, res) => {
  if (!env.PAYMOB_HMAC_SECRET) {
    res
      .status(503)
      .json({ data: null, error: { code: 'NOT_CONFIGURED', message: 'Payments not configured' } })
    return
  }

  const callback = paymobCallbackSchema.safeParse(req.body)
  if (!callback.success) {
    res.status(400).json({ data: null, error: { code: 'BAD_REQUEST', message: 'Invalid payload' } })
    return
  }
  if (callback.data.type !== 'TRANSACTION') return reply(res, 200, { ignored: true })

  if (!verifyTransactionHmac(callback.data.obj, req.query.hmac, env.PAYMOB_HMAC_SECRET)) {
    console.warn('[payments] rejected webhook: invalid HMAC')
    res
      .status(401)
      .json({ data: null, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } })
    return
  }

  const tx = paymobTransactionSchema.safeParse(callback.data.obj)
  if (!tx.success) {
    res
      .status(400)
      .json({ data: null, error: { code: 'BAD_REQUEST', message: 'Invalid transaction' } })
    return
  }
  const t = tx.data
  const eventKey = [
    t.id,
    t.success,
    t.pending,
    t.is_refunded || t.is_refund,
    t.is_voided || t.is_void,
  ].join(':')
  const payloadDigest = sha256(JSON.stringify(req.body))

  let eventId: string
  try {
    const created = await prisma.webhookEvent.create({
      data: { provider: PROVIDER, providerEventId: eventKey, payloadDigest },
    })
    eventId = created.id
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
      throw error
    const existing = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventKey } },
    })
    if (existing.processingStatus === 'PROCESSED' || existing.processingStatus === 'REJECTED') {
      return reply(res, 200, { duplicate: true })
    }
    eventId = existing.id
  }

  try {
    const outcome = await processTransaction(t, 'webhook')
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processingStatus: REJECTED_OUTCOMES.has(outcome) ? 'REJECTED' : 'PROCESSED',
        processedAt: new Date(),
      },
    })
    reply(res, 200, { outcome })
  } catch (error) {
    await prisma.webhookEvent
      .update({ where: { id: eventId }, data: { processingStatus: 'FAILED' } })
      .catch(() => undefined)
    throw error
  }
})
