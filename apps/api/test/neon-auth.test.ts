import { randomUUID } from 'node:crypto'
import { type JWTVerifyGetKey, SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { configureAuthMode, resolveAuthRuntime } from '../src/services/auth-mode.js'
import { UnavailableMailer } from '../src/services/mailer.js'
import {
  type NeonAuthConfig,
  NeonAuthConfigError,
  type UpstreamSession,
  configureNeonAuth,
  resolveNeonAuthConfig,
} from '../src/services/neon-auth.js'
import { configureOAuth } from '../src/services/oauth.js'
import { Client, PASSWORD, resetDb, signedUpClient } from './helpers.js'

const BASE = 'https://ep-fake-123.neonauth.us-east-2.aws.neon.tech/neondb/auth'
const BASE_ORIGIN = 'https://ep-fake-123.neonauth.us-east-2.aws.neon.tech'
const APP = 'https://portfolab-beta.onrender.com'
const KID = 'test-key'
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const STALE_SIGN_IN_MS = 10 * MINUTE_MS

function capture(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return null
}

describe('neon mode configuration', () => {
  const PROD = { NODE_ENV: 'production' as const, APP_URL: APP, AUTH_MODE: 'neon' as const }

  it('is an explicit opt-in that requires a base URL', () => {
    expect(capture(() => resolveAuthRuntime(PROD))).toBeInstanceOf(NeonAuthConfigError)
  })

  it('rejects insecure or ambiguous URLs', () => {
    const cases = [
      { NEON_AUTH_BASE_URL: 'http://ep-fake.neonauth.aws.neon.tech/neondb/auth' },
      { NEON_AUTH_BASE_URL: `${BASE}?x=1` },
      { NEON_AUTH_BASE_URL: 'https://user:pass@ep-fake.neon.tech/auth' },
      { NEON_AUTH_BASE_URL: 'not a url' },
      { NEON_AUTH_BASE_URL: BASE, NEON_AUTH_JWKS_URL: 'https://attacker.example/jwks.json' },
    ]
    for (const extra of cases) {
      expect(capture(() => resolveAuthRuntime({ ...PROD, ...extra }))).toBeInstanceOf(
        NeonAuthConfigError,
      )
    }
    const httpApp = capture(() =>
      resolveAuthRuntime({ ...PROD, APP_URL: 'http://x.onrender.com', NEON_AUTH_BASE_URL: BASE }),
    )
    expect(httpApp).toBeInstanceOf(NeonAuthConfigError)
  })

  it('never enables local OAuth or mail and derives strict JWT expectations', () => {
    const runtime = resolveAuthRuntime({
      ...PROD,
      NEON_AUTH_BASE_URL: `${BASE}/`,
      GOOGLE_CLIENT_ID: 'g-id-FAKE',
      GOOGLE_CLIENT_SECRET: 'g-secret-FAKE',
      MAIL_PROVIDER: 'console',
    })
    expect(runtime.mode).toBe('neon')
    expect(runtime.oauth).toEqual({})
    expect(runtime.mailer).toBeInstanceOf(UnavailableMailer)
    expect(runtime.neon).toEqual({
      baseUrl: BASE,
      jwksUrl: `${BASE}/.well-known/jwks.json`,
      issuers: [BASE, BASE_ORIGIN],
      audiences: [BASE, BASE_ORIGIN],
      requireEmailVerified: false,
    })
  })

  it('allows explicit issuer and audience overrides', () => {
    const config = resolveNeonAuthConfig({
      NODE_ENV: 'production',
      APP_URL: APP,
      NEON_AUTH_BASE_URL: BASE,
      NEON_AUTH_JWT_ISSUER: BASE_ORIGIN,
      NEON_AUTH_JWT_AUDIENCE: `${BASE_ORIGIN}, ${BASE}`,
    })
    expect(config.issuers).toEqual([BASE_ORIGIN])
    expect(config.audiences).toEqual([BASE_ORIGIN, BASE])
  })
})

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']

interface FakeUpstream {
  subject: string
  createdAt: Date
  expiresAt: Date
}

const upstream = new Map<string, FakeUpstream>()
let signingKey: SigningKey
let foreignKey: SigningKey
let keys: JWTVerifyGetKey
let config: NeonAuthConfig

async function fakeLookup(sessionId: string, subject: string): Promise<UpstreamSession | null> {
  const row = upstream.get(sessionId)
  if (!row || row.subject !== subject || row.expiresAt <= new Date()) return null
  return { createdAt: row.createdAt, expiresAt: row.expiresAt }
}

function upstreamSession(subject: string, createdAt = new Date()) {
  const id = randomUUID()
  upstream.set(id, { subject, createdAt, expiresAt: new Date(Date.now() + DAY_MS) })
  return id
}

interface TokenOptions {
  key?: SigningKey
  issuer?: string
  audience?: string
  expiresAt?: number
  claims?: Record<string, unknown>
}

function token(subject: string, email: string, options: TokenOptions = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email, emailVerified: true, name: 'Neon Student', ...options.claims })
    .setProtectedHeader({ alg: 'EdDSA', kid: KID })
    .setSubject(subject)
    .setIssuer(options.issuer ?? BASE)
    .setAudience(options.audience ?? BASE)
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 15 * 60)
    .sign(options.key ?? signingKey)
}

function b64(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

async function bridge(
  client: Client,
  input: { token: string; sessionId: string },
  intent: 'login' | 'signup' = 'signup',
  acceptPrivacy = true,
) {
  return client.post('/api/auth/neon/session', {
    ...input,
    intent,
    ...(intent === 'signup' ? { acceptPrivacy } : {}),
  })
}

async function neonClient(subject = randomUUID(), email = `${subject.slice(0, 8)}@example.test`) {
  const client = await new Client().init()
  const sessionId = upstreamSession(subject)
  const res = await bridge(client, { token: await token(subject, email), sessionId })
  if (res.status !== 201)
    throw new Error(`bridge failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { client, subject, email, sessionId, userId: res.body.data.user.id as string }
}

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
  signingKey = pair.privateKey
  foreignKey = (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey
  const jwk = await exportJWK(pair.publicKey)
  keys = createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: 'EdDSA' }] })
  config = resolveNeonAuthConfig({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    NEON_AUTH_BASE_URL: BASE,
  })
})

function enableNeon() {
  configureAuthMode('neon')
  configureNeonAuth({ config, keys, lookupSession: fakeLookup })
}

function disableNeon() {
  configureAuthMode('password')
  configureNeonAuth({ config: null })
}

describe('neon session bridge', () => {
  beforeEach(async () => {
    await resetDb()
    upstream.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    enableNeon()
  })

  afterEach(() => {
    disableNeon()
    configureOAuth({ config: {} })
    vi.restoreAllMocks()
  })

  afterAll(() => {
    disableNeon()
  })

  it('exposes only the public auth URL and no local password or OAuth surface', async () => {
    configureOAuth({ config: { google: { clientId: 'g', clientSecret: 'g-secret' } } })
    const res = await new Client().get('/api/auth/oauth/providers')
    expect(res.body.data).toEqual({
      mode: 'neon',
      passwordAuth: false,
      providers: [],
      linkedProviders: null,
      neonAuthUrl: BASE,
    })
    const anon = await new Client().init()
    const start = await anon.post('/api/auth/oauth/google/start', { intent: 'login' })
    expect(start.status).toBe(404)
    const legacy = await anon.post('/api/auth/login', {
      email: 'x@example.test',
      password: PASSWORD,
    })
    expect(legacy.body.error.code).toBe('PASSWORD_AUTH_DISABLED')
  })

  it('refuses the bridge outside neon mode', async () => {
    disableNeon()
    const client = await new Client().init()
    const subject = randomUUID()
    const res = await bridge(client, {
      token: 'a.b.c',
      sessionId: upstreamSession(subject),
    })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NEON_AUTH_DISABLED')
  })

  it('creates a mapped local account from verified claims only, bound to the upstream session', async () => {
    const { client, subject, sessionId, userId } = await neonClient()
    const me = await client.get('/api/auth/me')
    expect(me.body.data.user).toMatchObject({ id: userId, displayName: 'Neon Student' })

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { neonIdentity: true, sessions: true },
    })
    expect(user.neonIdentity?.subject).toBe(subject)
    expect(user.passwordHash.startsWith('!neon-managed-')).toBe(true)
    expect(user.privacyAcceptedAt).toBeInstanceOf(Date)
    expect(user.sessions.map((s) => s.neonSessionId)).toEqual([sessionId])

    const onboarding = await client.patch('/api/me/profile', { experienceLevel: 'NEW' })
    expect(onboarding.status).toBe(200)
  })

  it('rejects client-supplied identity fields', async () => {
    const client = await new Client().init()
    const subject = randomUUID()
    const res = await client.post('/api/auth/neon/session', {
      token: await token(subject, 'real@example.test'),
      sessionId: upstreamSession(subject),
      intent: 'signup',
      acceptPrivacy: true,
      email: 'admin@example.test',
      userId: 'someone-else',
    })
    expect(res.status).toBe(400)
    expect(await prisma.user.count()).toBe(0)
  })

  it('requires privacy consent before creating a local account', async () => {
    const client = await new Client().init()
    const subject = randomUUID()
    const proof = {
      token: await token(subject, 'new@example.test'),
      sessionId: upstreamSession(subject),
    }

    const login = await bridge(client, proof, 'login')
    expect(login.status).toBe(403)
    expect(login.body.error.code).toBe('SIGNUP_REQUIRED')
    const declined = await bridge(client, proof, 'signup', false)
    expect(declined.body.error.code).toBe('SIGNUP_REQUIRED')
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.session.count()).toBe(0)

    expect((await bridge(client, proof, 'signup')).status).toBe(201)
  })

  it('rejects forged, foreign, expired, and unsigned tokens', async () => {
    const subject = randomUUID()
    const email = 'victim@example.test'
    const sessionId = upstreamSession(subject)
    const now = Math.floor(Date.now() / 1000)
    const hs256 = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256', kid: KID })
      .setSubject(subject)
      .setIssuer(BASE)
      .setAudience(BASE)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('x'.repeat(32)))
    const valid = await token(subject, email)
    const [, payload] = valid.split('.')
    const forgedPayload = b64({
      sub: randomUUID(),
      email,
      iss: BASE,
      aud: BASE,
      iat: now,
      exp: now + 900,
    })

    const tokens = [
      await token(subject, email, { key: foreignKey }),
      await token(subject, email, { issuer: 'https://evil.example' }),
      await token(subject, email, { audience: 'https://evil.example' }),
      await token(subject, email, { expiresAt: now - 60 }),
      hs256,
      `${b64({ alg: 'none' })}.${payload}.`,
      `${valid.split('.')[0]}.${forgedPayload}.${valid.split('.')[2]}`,
      'not-a-jwt',
    ]
    for (const forged of tokens) {
      const client = await new Client().init()
      const res = await bridge(client, { token: forged, sessionId })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('NEON_TOKEN_INVALID')
      expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
    }
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.session.count()).toBe(0)
  })

  it('rejects a valid token paired with a session it does not own', async () => {
    const victim = randomUUID()
    const attacker = randomUUID()
    const victimSession = upstreamSession(victim)
    const client = await new Client().init()
    const cases = [
      { token: await token(attacker, 'attacker@example.test'), sessionId: victimSession },
      { token: await token(attacker, 'attacker@example.test'), sessionId: randomUUID() },
    ]
    for (const proof of cases) {
      const res = await bridge(client, proof)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('NEON_SESSION_INVALID')
    }
    expect(await prisma.user.count()).toBe(0)
  })

  it('never links an existing local email or touches its password', async () => {
    disableNeon()
    const legacy = await signedUpClient({ email: 'taken@example.test' })
    const before = await prisma.user.findUniqueOrThrow({ where: { id: legacy.userId } })
    enableNeon()

    const subject = randomUUID()
    const client = await new Client().init()
    const res = await bridge(client, {
      token: await token(subject, 'TAKEN@Example.test'),
      sessionId: upstreamSession(subject),
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_IN_USE')

    const after = await prisma.user.findUniqueOrThrow({ where: { id: legacy.userId } })
    expect(after.passwordHash).toBe(before.passwordHash)
    expect(await prisma.neonAuthIdentity.count()).toBe(0)
    expect(await prisma.user.count()).toBe(1)
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
  })

  it('logs an existing mapping in by subject, not by email', async () => {
    const { subject, userId } = await neonClient(randomUUID(), 'first@example.test')
    const client = await new Client().init()
    const res = await bridge(
      client,
      { token: await token(subject, 'changed@example.test'), sessionId: upstreamSession(subject) },
      'login',
    )
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ created: false, user: { id: userId } })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(
      'first@example.test',
    )
  })

  it('ends the local session as soon as the upstream session is revoked', async () => {
    const { client, sessionId } = await neonClient()
    expect((await client.get('/api/auth/me')).body.data.user).not.toBeNull()
    upstream.delete(sessionId)
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
    const local = await prisma.session.findFirstOrThrow({ where: { neonSessionId: sessionId } })
    expect(local.revokedAt).toBeInstanceOf(Date)
  })

  it('fails closed when the upstream check errors', async () => {
    const { client } = await neonClient()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    configureNeonAuth({
      lookupSession: () => Promise.reject(new Error('db down')),
    })
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
  })

  it('keeps legacy and neon sessions apart across modes', async () => {
    disableNeon()
    const legacy = await signedUpClient()
    enableNeon()
    expect((await legacy.client.get('/api/auth/me')).body.data.user).toBeNull()

    const neon = await neonClient()
    disableNeon()
    expect((await neon.client.get('/api/auth/me')).body.data.user).toBeNull()
    expect((await legacy.client.get('/api/auth/me')).body.data.user).not.toBeNull()
  })

  it('logout revokes the bound local session', async () => {
    const { client } = await neonClient()
    expect((await client.post('/api/auth/logout')).status).toBe(200)
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()
  })
})

describe('neon account deletion', () => {
  beforeEach(async () => {
    await resetDb()
    upstream.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    enableNeon()
  })

  afterEach(() => {
    disableNeon()
    vi.restoreAllMocks()
  })

  it('refuses legacy proofs and stale or foreign Neon sign-ins', async () => {
    const { client, subject, userId } = await neonClient()
    const other = randomUUID()

    const attempts = [
      { confirm: 'DELETE', password: PASSWORD },
      { confirm: 'DELETE' },
      {
        confirm: 'DELETE',
        neonProof: {
          token: await token(subject, 'x@example.test'),
          sessionId: upstreamSession(subject, new Date(Date.now() - STALE_SIGN_IN_MS)),
        },
      },
      {
        confirm: 'DELETE',
        neonProof: {
          token: await token(other, 'other@example.test'),
          sessionId: upstreamSession(other),
        },
      },
    ]
    for (const body of attempts) {
      const res = await client.post('/api/me/delete', body)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('REAUTH_REQUIRED')
    }
    const forged = await client.post('/api/me/delete', {
      confirm: 'DELETE',
      neonProof: {
        token: await token(subject, 'x@example.test', { key: foreignKey }),
        sessionId: upstreamSession(subject),
      },
    })
    expect(forged.status).toBe(401)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletedAt).toBeNull()
  })

  it('deletes with a fresh sign-in and keeps the deleted account unavailable', async () => {
    const { client, subject, email, userId } = await neonClient()
    const res = await client.post('/api/me/delete', {
      confirm: 'DELETE',
      neonProof: { token: await token(subject, email), sessionId: upstreamSession(subject) },
    })
    expect(res.status).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.deletedAt).toBeInstanceOf(Date)
    expect(user.email).not.toBe(email)
    expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBe(0)
    expect((await client.get('/api/auth/me')).body.data.user).toBeNull()

    const again = await new Client().init()
    const relogin = await bridge(again, {
      token: await token(subject, email),
      sessionId: upstreamSession(subject),
    })
    expect(relogin.status).toBe(403)
    expect(relogin.body.error.code).toBe('ACCOUNT_UNAVAILABLE')
    expect(await prisma.user.count()).toBe(1)
  })
})
