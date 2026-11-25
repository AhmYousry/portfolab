import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'
import { OAUTH_COOKIE } from '../src/routes/oauth.js'
import { hmac, sha256 } from '../src/security/tokens.js'
import {
  DELETE_ACCOUNT_PURPOSE,
  REAUTH_COOKIE,
  issueDeletionGrant,
} from '../src/services/account-deletion.js'
import { configureAuthMode } from '../src/services/auth-mode.js'
import { configureOAuth } from '../src/services/oauth.js'
import { Client, ORIGIN, PASSWORD, app, resetDb, signedUpClient } from './helpers.js'

const GOOGLE = { clientId: 'google-client.apps.test', clientSecret: 'google-secret-FAKE-0001' }
const GITHUB = { clientId: 'github-client-FAKE', clientSecret: 'github-secret-FAKE-0001' }
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const GITHUB_ACCESS_TOKEN = 'gho_FAKE_GITHUB_ACCESS_TOKEN'
const MINUTE_MS = 60_000

interface GithubAccount {
  id: number
  login: string
  email: string
}

let github: GithubAccount
let seq = 0
const challenges = new Map<string, string>()

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
  const url = String(input)
  if (url === GITHUB_TOKEN_URL) {
    const form = new URLSearchParams(String(init?.body ?? ''))
    const challenge = challenges.get(form.get('code') ?? '')
    const verifier = form.get('code_verifier') ?? ''
    const valid =
      challenge !== undefined &&
      createHash('sha256').update(verifier).digest('base64url') === challenge &&
      form.get('client_secret') === GITHUB.clientSecret
    if (!valid) return json(200, { error: 'bad_verification_code' })
    challenges.delete(form.get('code') ?? '')
    return json(200, { access_token: GITHUB_ACCESS_TOKEN, token_type: 'bearer' })
  }
  if (url === GITHUB_USER_URL) {
    return json(200, { id: github.id, login: github.login, name: 'Octo' })
  }
  if (url === GITHUB_EMAILS_URL) {
    return json(200, [{ email: github.email, primary: true, verified: true }])
  }
  return json(404, { message: 'unexpected url' })
})

function setCookies(res: { headers: Record<string, unknown> }): string[] {
  return ([] as string[]).concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
}

function grantCookieFrom(res: { headers: Record<string, unknown> }) {
  return setCookies(res).find(
    (c) => c.startsWith(`${REAUTH_COOKIE}=`) && !c.startsWith(`${REAUTH_COOKIE}=;`),
  )
}

function location(res: { status: number; headers: Record<string, unknown> }) {
  expect(res.status).toBe(303)
  return new URL(String(res.headers.location ?? ''))
}

async function linkedUser() {
  const signed = await signedUpClient()
  await prisma.oAuthIdentity.create({
    data: { userId: signed.userId, provider: 'GITHUB', subject: String(github.id) },
  })
  return signed
}

async function startReauth(client: Client, provider: 'github' | 'google' = 'github') {
  return client.post(`/api/auth/oauth/${provider}/start`, { intent: 'reauth' })
}

function authorize(authUrl: URL) {
  const code = `code-${seq}-${challenges.size}`
  challenges.set(code, authUrl.searchParams.get('code_challenge') ?? '')
  return code
}

async function reauthCallback(client: Client) {
  const start = await startReauth(client)
  expect(start.status).toBe(200)
  const authUrl = new URL(start.body.data.url as string)
  const code = authorize(authUrl)
  const state = authUrl.searchParams.get('state') ?? ''
  return client.get(`/api/auth/oauth/github/callback?${new URLSearchParams({ code, state })}`)
}

async function sessionIdOf(userId: string) {
  const session = await prisma.session.findFirstOrThrow({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return session.id
}

interface RawSession {
  cookie: string
  csrfToken: string
  sessionId: string
}

// A browser session driven with explicit Cookie headers, so a grant cookie can be presented
// from any chosen session.
async function rawLogin(email: string): Promise<RawSession> {
  const csrf = await request(app).get('/api/auth/csrf')
  const csrfToken = csrf.body.data.csrfToken as string
  const csrfCookie = `pb_csrf=${csrfToken}`
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', csrfToken)
    .set('Cookie', csrfCookie)
    .send({ email, password: PASSWORD })
  expect(res.status).toBe(200)
  const sessionCookie = setCookies(res)
    .find((c) => c.startsWith('pb_session='))
    ?.split(';')[0]
  const sessionToken = sessionCookie?.split('=')[1] ?? ''
  const session = await prisma.session.findUniqueOrThrow({
    where: { sessionTokenHash: sha256(sessionToken) },
  })
  return { cookie: `${csrfCookie}; ${sessionCookie}`, csrfToken, sessionId: session.id }
}

function rawPost(session: RawSession, path: string, body: object, extraCookie = '') {
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', session.csrfToken)
    .set('Cookie', extraCookie ? `${session.cookie}; ${extraCookie}` : session.cookie)
    .send(body)
}

function deleteWithToken(session: RawSession, token: string) {
  return rawPost(session, '/api/me/delete', { confirm: 'DELETE' }, `${REAUTH_COOKIE}=${token}`)
}

async function grantFor(userId: string, session: RawSession) {
  const token = await issueDeletionGrant({
    userId,
    sessionId: session.sessionId,
    provider: 'GITHUB',
  })
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  return token ?? ''
}

async function expectNotDeleted(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  expect(user.deletedAt).toBeNull()
  expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(1)
}

beforeEach(async () => {
  await resetDb()
  seq += 1
  challenges.clear()
  github = { id: 5000 + seq, login: `octo${seq}`, email: `octo${seq}@example.test` }
  fetchMock.mockClear()
  configureAuthMode('password')
  configureOAuth({ config: { google: GOOGLE, github: GITHUB }, fetch: fetchMock })
})

afterAll(() => {
  configureAuthMode('password')
  configureOAuth({ config: {} })
})

describe('reauth start', () => {
  it('requires a signed-in session', async () => {
    const anon = await new Client().init()
    const res = await startReauth(anon)
    expect(res.status).toBe(401)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('requires CSRF', async () => {
    const { client } = await linkedUser()
    const res = await client.agent
      .post('/api/auth/oauth/github/start')
      .set('Origin', ORIGIN)
      .send({ intent: 'reauth' })
    expect(res.status).toBe(403)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('only offers a provider that is linked to this account', async () => {
    const { client } = await linkedUser()
    const res = await startReauth(client, 'google')
    expect(res.status).toBe(400)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('rejects next/acceptPrivacy on a reauth start', async () => {
    const { client } = await linkedUser()
    for (const extra of [{ next: '//evil.example' }, { acceptPrivacy: true }]) {
      const res = await client.post('/api/auth/oauth/github/start', { intent: 'reauth', ...extra })
      expect(res.status).toBe(400)
    }
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('binds the attempt to the exact user and session', async () => {
    const { client, userId } = await linkedUser()
    expect((await startReauth(client)).status).toBe(200)
    const attempt = await prisma.oAuthAttempt.findFirstOrThrow()
    expect(attempt).toMatchObject({
      intent: 'reauth',
      userId,
      sessionId: await sessionIdOf(userId),
      nextPath: '/account',
      privacyAccepted: false,
    })
  })
})

describe('reauth callback', () => {
  it('issues a hashed, short-lived, session-bound grant via a scoped HttpOnly cookie', async () => {
    const { client, userId } = await linkedUser()
    configureAuthMode('social')
    const sessionsBefore = await prisma.session.count()

    const res = await reauthCallback(client)
    const loc = location(res)
    expect(`${loc.pathname}${loc.search}`).toBe('/account?reauth=ok')

    const cookie = grantCookieFrom(res)
    expect(cookie).toBeDefined()
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/api/me/delete')
    expect(cookie).toContain('SameSite=Strict')
    const token = /^pb_reauth=([a-f0-9]{64});/.exec(cookie ?? '')?.[1] ?? ''
    expect(token).toHaveLength(64)

    const grant = await prisma.reauthGrant.findFirstOrThrow()
    expect(grant.tokenHash).toBe(sha256(token))
    expect(JSON.stringify(grant)).not.toContain(token)
    expect(grant).toMatchObject({
      userId,
      sessionId: await sessionIdOf(userId),
      provider: 'GITHUB',
      purpose: DELETE_ACCOUNT_PURPOSE,
      consumedAt: null,
    })
    const ttl = grant.expiresAt.getTime() - grant.createdAt.getTime()
    expect(ttl).toBeGreaterThan(4 * MINUTE_MS)
    expect(ttl).toBeLessThanOrEqual(5 * MINUTE_MS + 1000)

    expect(await prisma.session.count()).toBe(sessionsBefore)
    expect(await prisma.oAuthIdentity.count()).toBe(1)
    expect((await client.get('/api/auth/me')).body.data.user.id).toBe(userId)
  })

  it('refuses a different provider account and never links or switches identity', async () => {
    const { client, userId } = await linkedUser()
    const other = await signedUpClient()
    const otherSubject = 424_242
    await prisma.oAuthIdentity.create({
      data: { userId: other.userId, provider: 'GITHUB', subject: String(otherSubject) },
    })

    for (const subject of [999_999, otherSubject]) {
      github.id = subject
      const res = await reauthCallback(client)
      const loc = location(res)
      expect(loc.pathname).toBe('/account')
      expect(loc.searchParams.get('reauth_error')).toBe('reauth_mismatch')
      expect(grantCookieFrom(res)).toBeUndefined()
    }

    expect(await prisma.reauthGrant.count()).toBe(0)
    expect(await prisma.oAuthIdentity.count()).toBe(2)
    expect((await client.get('/api/auth/me')).body.data.user.id).toBe(userId)
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(1)
  })

  it('refuses when the original session changed before the callback (no provider call)', async () => {
    const { client, email, userId } = await linkedUser()
    const start = await startReauth(client)
    const authUrl = new URL(start.body.data.url as string)

    await client.post('/api/auth/logout')
    const login = await client.post('/api/auth/login', { email, password: PASSWORD })
    expect(login.status).toBe(200)

    const code = authorize(authUrl)
    const state = authUrl.searchParams.get('state') ?? ''
    const res = await client.get(
      `/api/auth/oauth/github/callback?${new URLSearchParams({ code, state })}`,
    )
    expect(location(res).searchParams.get('reauth_error')).toBe('session_changed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.reauthGrant.count()).toBe(0)
    expect((await client.get('/api/auth/me')).body.data.user.id).toBe(userId)
  })

  it('refuses a callback with the bound state but no live session', async () => {
    const { client } = await linkedUser()
    const start = await startReauth(client)
    const authUrl = new URL(start.body.data.url as string)
    const state = authUrl.searchParams.get('state') ?? ''
    const code = authorize(authUrl)

    const res = await request(app)
      .get(`/api/auth/oauth/github/callback?${new URLSearchParams({ code, state })}`)
      .set('Cookie', `${OAUTH_COOKIE}=${state}.${hmac(env.SESSION_SECRET, `oauth-state:${state}`)}`)
    expect(location(res).searchParams.get('reauth_error')).toBe('session_changed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.session.count()).toBe(1)
    expect(await prisma.reauthGrant.count()).toBe(0)
  })

  it('returns a cancelled reauth to the account page', async () => {
    const { client } = await linkedUser()
    const start = await startReauth(client)
    const state = new URL(start.body.data.url as string).searchParams.get('state') ?? ''
    const res = await client.get(
      `/api/auth/oauth/github/callback?${new URLSearchParams({ error: 'access_denied', state })}`,
    )
    const loc = location(res)
    expect(loc.pathname).toBe('/account')
    expect(loc.searchParams.get('reauth_error')).toBe('cancelled')
    expect(await prisma.reauthGrant.count()).toBe(0)
  })
})

describe('account deletion with a reauth grant', () => {
  it('deletes, unlinks, revokes, and consumes the grant in one step (social mode)', async () => {
    const { client, userId, email } = await linkedUser()
    configureAuthMode('social')
    await reauthCallback(client)

    const res = await client.post('/api/me/delete', { confirm: 'DELETE' })
    expect(res.status).toBe(200)
    const cleared = setCookies(res).find((c) => c.startsWith(`${REAUTH_COOKIE}=;`))
    expect(cleared).toContain('Path=/api/me/delete')

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.deletedAt).not.toBeNull()
    expect(user.email).not.toBe(email)
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(0)
    expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBe(0)
    expect((await prisma.reauthGrant.findFirstOrThrow()).consumedAt).toBeInstanceOf(Date)
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
  })

  it('requires confirm=DELETE and a grant', async () => {
    const { client, userId } = await linkedUser()
    expect((await client.post('/api/me/delete', {})).status).toBe(400)
    const none = await client.post('/api/me/delete', { confirm: 'DELETE' })
    expect(none.status).toBe(403)
    expect(none.body.error.code).toBe('REAUTH_REQUIRED')

    await reauthCallback(client)
    expect((await client.post('/api/me/delete', { confirm: 'delete' })).status).toBe(400)
    await expectNotDeleted(userId)
    expect((await prisma.reauthGrant.findFirstOrThrow()).consumedAt).toBeNull()
  })

  it('accepts a valid grant from its own session', async () => {
    const { userId, email } = await linkedUser()
    const session = await rawLogin(email)
    const res = await deleteWithToken(session, await grantFor(userId, session))
    expect(res.status).toBe(200)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletedAt,
    ).not.toBeNull()
  })

  it('rejects a replayed (already consumed) grant', async () => {
    const { userId, email } = await linkedUser()
    const session = await rawLogin(email)
    const token = await grantFor(userId, session)
    await prisma.reauthGrant.updateMany({ data: { consumedAt: new Date() } })
    const res = await deleteWithToken(session, token)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('REAUTH_REQUIRED')
    await expectNotDeleted(userId)
  })

  it('lets exactly one of two concurrent deletes consume the grant', async () => {
    const { userId, email } = await linkedUser()
    const session = await rawLogin(email)
    const token = await grantFor(userId, session)
    const results = await Promise.all([
      deleteWithToken(session, token),
      deleteWithToken(session, token),
    ])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses[0]).toBe(200)
    expect([401, 403]).toContain(statuses[1])
    expect(await prisma.reauthGrant.count({ where: { consumedAt: { not: null } } })).toBe(1)
  })

  it('rejects an expired grant', async () => {
    const { userId, email } = await linkedUser()
    const session = await rawLogin(email)
    const token = await grantFor(userId, session)
    await prisma.reauthGrant.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await deleteWithToken(session, token)).status).toBe(403)
    await expectNotDeleted(userId)
  })

  it('rejects a grant from another session of the same user', async () => {
    const { userId, email } = await linkedUser()
    const original = await rawLogin(email)
    const token = await grantFor(userId, original)
    const second = await rawLogin(email)

    expect((await deleteWithToken(second, token)).status).toBe(403)
    await expectNotDeleted(userId)
    expect((await prisma.reauthGrant.findFirstOrThrow()).consumedAt).toBeNull()
  })

  it('rejects a grant presented by a different (changed) account', async () => {
    const { userId, email } = await linkedUser()
    const token = await grantFor(userId, await rawLogin(email))
    const intruder = await signedUpClient()
    const intruderSession = await rawLogin(intruder.email)

    expect((await deleteWithToken(intruderSession, token)).status).toBe(403)
    await expectNotDeleted(userId)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: intruder.userId } })).deletedAt,
    ).toBeNull()
  })

  it('rejects the grant after logout, even after signing back in', async () => {
    const { userId, email } = await linkedUser()
    const session = await rawLogin(email)
    const token = await grantFor(userId, session)
    expect((await rawPost(session, '/api/auth/logout', {})).status).toBe(200)
    expect((await deleteWithToken(session, token)).status).toBe(401)

    const again = await rawLogin(email)
    expect((await deleteWithToken(again, token)).status).toBe(403)
    await expectNotDeleted(userId)
  })

  it('does not issue a grant for a revoked session', async () => {
    const { userId } = await linkedUser()
    const sessionId = await sessionIdOf(userId)
    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    expect(await issueDeletionGrant({ userId, sessionId, provider: 'GITHUB' })).toBeNull()
    expect(await prisma.reauthGrant.count()).toBe(0)
  })

  it('keeps password deletion working in password mode', async () => {
    const { client, userId } = await linkedUser()
    const res = await client.post('/api/me/delete', { password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(200)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletedAt,
    ).not.toBeNull()
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(0)
  })
})
