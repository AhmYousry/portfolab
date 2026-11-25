import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { drainMailDeliveries, mailer, setMailer } from '../src/services/mailer.js'
import { ResendMailer } from '../src/services/resend-mailer.js'
import { Client, PASSWORD, signedUpClient, resetDb } from './helpers.js'

const API_KEY = 're_fakeTestKey_0123456789abcdef'
const FROM = 'Portfolab <no-reply@mail.portfolab-fake.dev>'
const GHOST = 'ghost@example.test'
const FAILURE_LOG = '[mailer] password reset delivery failed'
const SLOW_PROVIDER_TIMEOUT_MS = 2_000
const initialMailer = mailer

beforeEach(async () => {
  await resetDb()
})

afterEach(async () => {
  await drainMailDeliveries()
  setMailer(initialMailer)
  vi.restoreAllMocks()
})

function resendWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new ResendMailer({ apiKey: API_KEY, from: FROM, fetch: fetchImpl, timeoutMs })
}

function captureLinks() {
  const links: string[] = []
  setMailer({ sendPasswordReset: async (_to, link) => void links.push(link) })
  return links
}

function tokenFrom(link: string | undefined) {
  return new URL(link ?? '').searchParams.get('token') ?? ''
}

describe('forgot-password delivery', () => {
  it('matches the unknown-account response when the provider rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response('{"message":"domain not verified"}', { status: 403 }),
    )
    setMailer(resendWith(fetchMock))
    const { email, userId } = await signedUpClient()
    const anon = await new Client().init()

    const known = await anon.post('/api/auth/forgot-password', { email })
    const ghost = await anon.post('/api/auth/forgot-password', { email: GHOST })
    await drainMailDeliveries()

    expect(known.status).toBe(200)
    expect(ghost.status).toBe(known.status)
    expect(ghost.body).toEqual(known.body)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(1)

    expect(errorSpy).toHaveBeenCalledWith(FAILURE_LOG, { reason: 'http', status: 403 })
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).not.toContain(email)
    expect(logged).not.toContain(API_KEY)
    expect(logged).not.toContain('reset-password?token=')
  })

  it('returns the same response on network failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setMailer(
      resendWith(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const { email } = await signedUpClient()
    const anon = await new Client().init()

    const known = await anon.post('/api/auth/forgot-password', { email })
    const ghost = await anon.post('/api/auth/forgot-password', { email: GHOST })
    await drainMailDeliveries()

    expect(ghost.status).toBe(known.status)
    expect(ghost.body).toEqual(known.body)
    expect(errorSpy).toHaveBeenCalledWith(FAILURE_LOG, { reason: 'network' })
  })

  it('does not wait for a slow provider before responding, then times out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let settled = false
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          signal?.addEventListener('abort', () => {
            settled = true
            reject(signal.reason)
          })
        }),
    )
    setMailer(resendWith(hanging, SLOW_PROVIDER_TIMEOUT_MS))
    const { email } = await signedUpClient()
    const anon = await new Client().init()

    const known = await anon.post('/api/auth/forgot-password', { email })
    expect(hanging).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    const ghost = await anon.post('/api/auth/forgot-password', { email: GHOST })
    expect(ghost.body).toEqual(known.body)

    await drainMailDeliveries()
    expect(settled).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(FAILURE_LOG, { reason: 'timeout' })
  })

  it('sends the reset link through Resend on success without logging errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('{"id":"e"}', { status: 200 }))
    setMailer(resendWith(fetchMock))
    const { email } = await signedUpClient()
    const anon = await new Client().init()

    const res = await anon.post('/api/auth/forgot-password', { email })
    await drainMailDeliveries()

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { to: string[] }
    expect(body.to).toEqual([email])
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('reset-password token consumption', () => {
  it('lets exactly one of two concurrent requests consume a token', async () => {
    const links = captureLinks()
    const { email } = await signedUpClient()
    const anon = await new Client().init()
    await anon.post('/api/auth/forgot-password', { email })
    await drainMailDeliveries()
    const token = tokenFrom(links[0])

    const [a, b] = await Promise.all([
      anon.post('/api/auth/reset-password', { token, password: 'first-new-password' }),
      anon.post('/api/auth/reset-password', { token, password: 'second-new-password' }),
    ])

    expect([a.status, b.status].sort()).toEqual([200, 400])
    const winner = a.status === 200 ? 'first-new-password' : 'second-new-password'
    const loser = a.status === 200 ? 'second-new-password' : 'first-new-password'
    const fresh = await new Client().init()
    expect((await fresh.post('/api/auth/login', { email, password: loser })).status).toBe(401)
    expect((await fresh.post('/api/auth/login', { email, password: winner })).status).toBe(200)
  })

  it('keeps the original password when the token is unknown', async () => {
    const { email } = await signedUpClient()
    const anon = await new Client().init()
    const res = await anon.post('/api/auth/reset-password', {
      token: 'f'.repeat(64),
      password: 'a-brand-new-password',
    })
    expect(res.status).toBe(400)
    expect((await anon.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(200)
  })
})
