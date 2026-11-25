import { createHash, randomUUID } from 'node:crypto'
import { type JWTVerifyGetKey, SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'
import { OAUTH_COOKIE, safeNextPath } from '../src/routes/oauth.js'
import { hashPassword } from '../src/security/password.js'
import { hmac, randomToken } from '../src/security/tokens.js'
import { OAuthConfigError, configureOAuth, resolveOAuthConfig } from '../src/services/oauth.js'
import { Client, PASSWORD, app, resetDb, signedUpClient } from './helpers.js'

type Provider = 'google' | 'github'
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']

const APP = 'http://localhost:5173'
const GOOGLE = { clientId: 'google-client.apps.test', clientSecret: 'google-secret-FAKE-0001' }
const GITHUB = { clientId: 'github-client-FAKE', clientSecret: 'github-secret-FAKE-0001' }
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const GOOGLE_ACCESS_TOKEN = 'ya29.FAKE-GOOGLE-ACCESS-TOKEN'
const GITHUB_ACCESS_TOKEN = 'gho_FAKE_GITHUB_ACCESS_TOKEN'
const KID = 'test-key-1'
const HOUR_S = 3600

interface GoogleScenario {
  sub: string
  email?: string
  emailVerified?: boolean
  name?: string
  nonce?: string
  audience?: string
  issuer?: string
  expired?: boolean
  signWith?: PrivateKey
}

interface GithubScenario {
  id: number
  login: string
  name: string | null
  emails: { email: string; primary: boolean; verified: boolean }[]
  tokenBody?: Record<string, unknown>
}

interface Grant {
  provider: Provider
  challenge: string
  nonce: string | null
  redirectUri: string
}

let signingKey: PrivateKey
let otherKey: PrivateKey
let jwks: JWTVerifyGetKey
let google: GoogleScenario
let github: GithubScenario
let tokenStatus: number | null
let seq = 0
const grants = new Map<string, Grant>()

function pkce(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function idToken(nonce: string | null) {
  const now = Math.floor(Date.now() / 1000)
  const iat = google.expired ? now - 2 * HOUR_S : now
  const claims: Record<string, unknown> = {
    sub: google.sub,
    nonce: google.nonce ?? nonce,
    name: google.name,
  }
  if (google.email !== undefined) claims.email = google.email
  if (google.emailVerified !== undefined) claims.email_verified = google.emailVerified
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(google.issuer ?? 'https://accounts.google.com')
    .setAudience(google.audience ?? GOOGLE.clientId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + HOUR_S)
    .sign(google.signWith ?? signingKey)
}

function redeem(provider: Provider, form: URLSearchParams, secret: string): Grant | null {
  const code = form.get('code') ?? ''
  const grant = grants.get(code)
  if (!grant || grant.provider !== provider) return null
  if (form.get('client_secret') !== secret) return null
  if (form.get('redirect_uri') !== grant.redirectUri) return null
  if (pkce(form.get('code_verifier') ?? '') !== grant.challenge) return null
  grants.delete(code)
  return grant
}

const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
  const url = String(input)
  if (tokenStatus !== null && (url === GOOGLE_TOKEN_URL || url === GITHUB_TOKEN_URL)) {
    return json(tokenStatus, { error: 'server_error' })
  }
  const form = new URLSearchParams(String(init?.body ?? ''))
  if (url === GOOGLE_TOKEN_URL) {
    if (form.get('grant_type') !== 'authorization_code')
      return json(400, { error: 'invalid_grant' })
    const grant = redeem('google', form, GOOGLE.clientSecret)
    if (!grant) return json(400, { error: 'invalid_grant' })
    return json(200, {
      access_token: GOOGLE_ACCESS_TOKEN,
      id_token: await idToken(grant.nonce),
      token_type: 'Bearer',
      expires_in: HOUR_S,
    })
  }
  if (url === GITHUB_TOKEN_URL) {
    const grant = redeem('github', form, GITHUB.clientSecret)
    if (!grant) return json(200, { error: 'bad_verification_code' })
    return json(
      200,
      github.tokenBody ?? { access_token: GITHUB_ACCESS_TOKEN, token_type: 'bearer' },
    )
  }
  const authorized =
    new Headers(init?.headers).get('authorization') === `Bearer ${GITHUB_ACCESS_TOKEN}`
  if (url === GITHUB_USER_URL) {
    if (!authorized) return json(401, { message: 'Bad credentials' })
    return json(200, { id: github.id, login: github.login, name: github.name })
  }
  if (url === GITHUB_EMAILS_URL) {
    if (!authorized) return json(401, { message: 'Bad credentials' })
    return json(200, github.emails)
  }
  return json(404, { message: 'unexpected url' })
})

function authorize(provider: Provider, authUrl: URL): string {
  const code = `code-${randomUUID()}`
  grants.set(code, {
    provider,
    challenge: authUrl.searchParams.get('code_challenge') ?? '',
    nonce: authUrl.searchParams.get('nonce'),
    redirectUri: authUrl.searchParams.get('redirect_uri') ?? '',
  })
  return code
}

async function start(client: Client, provider: Provider, body: object) {
  const res = await client.post(`/api/auth/oauth/${provider}/start`, body)
  expect(res.status).toBe(200)
  return new URL(res.body.data.url as string)
}

function callbackPath(provider: Provider, params: Record<string, string>) {
  return `/api/auth/oauth/${provider}/callback?${new URLSearchParams(params)}`
}

async function complete(client: Client, provider: Provider, authUrl: URL) {
  const code = authorize(provider, authUrl)
  const state = authUrl.searchParams.get('state') ?? ''
  return client.get(callbackPath(provider, { code, state }))
}

function locationOf(res: { status: number; headers: Record<string, string> }) {
  expect(res.status).toBe(303)
  return new URL(res.headers.location ?? '')
}

function oauthError(res: { status: number; headers: Record<string, string> }) {
  return locationOf(res).searchParams.get('oauth_error')
}

async function me(client: Client) {
  const res = await client.get('/api/auth/me')
  return res.body.data.user as { id: string; email: string; displayName: string } | null
}

function signedStateCookie(state: string) {
  return `${OAUTH_COOKIE}=${state}.${hmac(env.SESSION_SECRET, `oauth-state:${state}`)}`
}

async function oauthSignup(provider: Provider, next = '/dashboard') {
  const client = await new Client().init()
  const authUrl = await start(client, provider, { intent: 'signup', acceptPrivacy: true, next })
  const res = await complete(client, provider, authUrl)
  return { client, res }
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  signingKey = pair.privateKey
  otherKey = (await generateKeyPair('RS256')).privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }
  jwks = createLocalJWKSet({ keys: [jwk] })
})

beforeEach(async () => {
  await resetDb()
  seq += 1
  grants.clear()
  tokenStatus = null
  google = {
    sub: `google-sub-${seq}`,
    email: `Google.User${seq}@Example.test`,
    emailVerified: true,
    name: 'Google User',
  }
  github = {
    id: 1000 + seq,
    login: `octo${seq}`,
    name: 'Octo Cat',
    emails: [
      { email: `secondary${seq}@example.test`, primary: false, verified: true },
      { email: `Octo${seq}@Example.test`, primary: true, verified: true },
    ],
  }
  fetchMock.mockClear()
  configureOAuth({ config: { google: GOOGLE, github: GITHUB }, fetch: fetchMock, googleKeys: jwks })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  configureOAuth({ config: {} })
})

describe('OAuth configuration', () => {
  const base = { NODE_ENV: 'development', APP_URL: APP }

  it('enables nothing when every pair is absent', () => {
    expect(resolveOAuthConfig(base)).toEqual({})
  })

  it('enables complete pairs', () => {
    const config = resolveOAuthConfig({
      ...base,
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
    })
    expect(Object.keys(config).sort()).toEqual(['github', 'google'])
  })

  it.each([
    { GOOGLE_CLIENT_ID: 'g-id' },
    { GOOGLE_CLIENT_SECRET: 'super-secret-value' },
    { GITHUB_CLIENT_ID: 'gh-id' },
    { GITHUB_CLIENT_SECRET: 'super-secret-value' },
  ])('rejects a partial pair %o without echoing the value', (partial) => {
    expect(() => resolveOAuthConfig({ ...base, ...partial })).toThrow(OAuthConfigError)
    try {
      resolveOAuthConfig({ ...base, ...partial })
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-value')
    }
  })

  it('requires https and a bare origin when a provider is enabled', () => {
    const pairs = { GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret' }
    expect(() =>
      resolveOAuthConfig({ NODE_ENV: 'production', APP_URL: 'http://portfolab.blog', ...pairs }),
    ).toThrow(OAuthConfigError)
    expect(() =>
      resolveOAuthConfig({ ...base, APP_URL: 'http://localhost:5173/app', ...pairs }),
    ).toThrow(OAuthConfigError)
    expect(
      resolveOAuthConfig({ NODE_ENV: 'production', APP_URL: 'https://portfolab.blog', ...pairs }),
    ).toHaveProperty('google')
  })
})

describe('provider discovery', () => {
  it('lists only configured providers and 404s disabled ones', async () => {
    const client = await new Client().init()
    expect((await client.get('/api/auth/oauth/providers')).body.data.providers).toEqual([
      'google',
      'github',
    ])

    configureOAuth({ config: { github: GITHUB } })
    expect((await client.get('/api/auth/oauth/providers')).body.data.providers).toEqual(['github'])
    const res = await client.post('/api/auth/oauth/google/start', { intent: 'login' })
    expect(res.status).toBe(404)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('requires CSRF on start', async () => {
    const res = await request(app)
      .post('/api/auth/oauth/google/start')
      .set('Origin', APP)
      .send({ intent: 'login' })
    expect(res.status).toBe(403)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })
})

describe('Google sign-up and login', () => {
  it('builds a PKCE S256 authorization request with a browser-bound state cookie', async () => {
    const client = await new Client().init()
    const res = await client.post('/api/auth/oauth/google/start', {
      intent: 'signup',
      acceptPrivacy: true,
    })
    expect(res.status).toBe(200)
    const url = new URL(res.body.data.url as string)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe(GOOGLE.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/oauth/google/callback`)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/)
    expect(res.text).not.toContain('client_secret')
    expect(res.text).not.toContain(GOOGLE.clientSecret)

    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith(`${OAUTH_COOKIE}=`))
    expect(cookie).toBeDefined()
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/api/auth/oauth')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain(url.searchParams.get('state') ?? 'missing-state')

    const attempt = await prisma.oAuthAttempt.findFirstOrThrow()
    expect(pkce(attempt.codeVerifier)).toBe(url.searchParams.get('code_challenge'))
    expect(attempt.stateHash).not.toBe(url.searchParams.get('state'))
  })

  it('creates a new account after privacy consent and lands on onboarding with next', async () => {
    const { client, res } = await oauthSignup('google', '/projects/taskflow-lite')
    const loc = locationOf(res)
    expect(`${loc.origin}${loc.pathname}`).toBe(`${APP}/onboarding`)
    expect(loc.searchParams.get('next')).toBe('/projects/taskflow-lite')

    const user = await me(client)
    expect(user?.email).toBe(`google.user${seq}@example.test`)
    expect(user?.displayName).toBe('Google User')

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user?.id ?? '' },
      include: { oauthIdentities: true },
    })
    expect(row.privacyAcceptedAt).toBeInstanceOf(Date)
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true)
    expect(row.oauthIdentities).toHaveLength(1)
    expect(row.oauthIdentities[0]).toMatchObject({ provider: 'GOOGLE', subject: google.sub })

    const persisted = JSON.stringify([
      await prisma.oAuthAttempt.findMany(),
      await prisma.oAuthIdentity.findMany(),
      await prisma.user.findMany(),
      await prisma.session.findMany(),
    ])
    expect(persisted).not.toContain(GOOGLE_ACCESS_TOKEN)
    expect(persisted).not.toContain('eyJ')
    expect((await prisma.oAuthAttempt.findFirstOrThrow()).consumedAt).toBeInstanceOf(Date)
    expect(await prisma.leadEvent.count({ where: { event: 'signup_complete' } })).toBe(1)
  })

  it('logs an existing identity back in to the requested next path', async () => {
    const first = await oauthSignup('google')
    const userId = (await me(first.client))?.id

    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'login', next: '/progress?tab=1' })
    const loc = locationOf(await complete(client, 'google', authUrl))
    expect(`${loc.origin}${loc.pathname}${loc.search}`).toBe(`${APP}/progress?tab=1`)
    expect((await me(client))?.id).toBe(userId)
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.oAuthIdentity.count()).toBe(1)
  })

  it('rejects a callback whose PKCE verifier does not match the challenge', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    await prisma.oAuthAttempt.updateMany({ data: { codeVerifier: 'x'.repeat(43) } })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const res = await complete(client, 'google', authUrl)
    expect(oauthError(res)).toBe('failed')
    expect(locationOf(res).pathname).toBe('/signup')
    expect(await prisma.user.count()).toBe(0)
    expect(await me(client)).toBeNull()
  })

  it.each([
    ['nonce mismatch', { nonce: 'attacker-nonce' }],
    ['wrong audience', { audience: 'someone-else.apps.test' }],
    ['wrong issuer', { issuer: 'https://evil.example' }],
    ['expired token', { expired: true }],
  ])('rejects an ID token with %s', async (_label, override) => {
    Object.assign(google, override)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { client, res } = await oauthSignup('google')
    expect(oauthError(res)).toBe('failed')
    expect(await prisma.user.count()).toBe(0)
    expect(await me(client)).toBeNull()
  })

  it('rejects an ID token signed by an unknown key', async () => {
    google.signWith = otherKey
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { res } = await oauthSignup('google')
    expect(oauthError(res)).toBe('failed')
    expect(await prisma.user.count()).toBe(0)
  })

  it.each([
    ['unverified', { emailVerified: false }],
    ['missing verification flag', { emailVerified: undefined }],
    ['missing email', { email: undefined }],
  ])('refuses a Google account with %s email', async (_label, override) => {
    Object.assign(google, override)
    const { client, res } = await oauthSignup('google')
    expect(oauthError(res)).toBe('email_unverified')
    expect(await prisma.user.count()).toBe(0)
    expect(await me(client)).toBeNull()
  })
})

describe('privacy consent for new OAuth accounts', () => {
  it.each([{}, { acceptPrivacy: false }])(
    'rejects a signup start without consent %o',
    async (extra) => {
      const client = await new Client().init()
      const res = await client.post('/api/auth/oauth/google/start', { intent: 'signup', ...extra })
      expect(res.status).toBe(400)
      expect(res.body.error.details).toEqual([
        { path: 'acceptPrivacy', message: expect.any(String) },
      ])
      expect(await prisma.oAuthAttempt.count()).toBe(0)
    },
  )

  it('never creates an account from the login page; sends the user to signup instead', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'login', next: '/resources' })
    const loc = locationOf(await complete(client, 'google', authUrl))
    expect(loc.pathname).toBe('/signup')
    expect(loc.searchParams.get('oauth_error')).toBe('signup_required')
    expect(loc.searchParams.get('next')).toBe('/resources')
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.oAuthIdentity.count()).toBe(0)
    expect(await me(client)).toBeNull()
  })

  it('rejects unknown start fields', async () => {
    const client = await new Client().init()
    const res = await client.post('/api/auth/oauth/google/start', {
      intent: 'signup',
      acceptPrivacy: true,
      email: 'victim@example.test',
    })
    expect(res.status).toBe(400)
  })
})

describe('email collisions and deleted users', () => {
  it('never links to or signs into an existing account by matching email', async () => {
    const existing = await signedUpClient({ email: `google.user${seq}@example.test` })
    const { client, res } = await oauthSignup('google')

    const loc = locationOf(res)
    expect(loc.pathname).toBe('/login')
    expect(loc.searchParams.get('oauth_error')).toBe('use_existing_method')
    expect(await me(client)).toBeNull()
    expect(await prisma.oAuthIdentity.count()).toBe(0)
    expect(await prisma.user.count()).toBe(1)

    const login = await client.post('/api/auth/login', {
      email: existing.email,
      password: PASSWORD,
    })
    expect(login.status).toBe(200)
  })

  it('treats a GitHub email that matches a Google-created account as a collision', async () => {
    google.email = `shared${seq}@example.test`
    await oauthSignup('google')
    github.emails = [{ email: `shared${seq}@example.test`, primary: true, verified: true }]

    const { client, res } = await oauthSignup('github')
    expect(oauthError(res)).toBe('use_existing_method')
    expect(await me(client)).toBeNull()
    expect(await prisma.oAuthIdentity.count({ where: { provider: 'GITHUB' } })).toBe(0)
  })

  it('refuses a soft-deleted user linked to the identity', async () => {
    const first = await oauthSignup('google')
    const userId = (await me(first.client))?.id ?? ''
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })

    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'login' })
    expect(oauthError(await complete(client, 'google', authUrl))).toBe('account_unavailable')
    expect(await me(client)).toBeNull()
    expect(await prisma.user.count()).toBe(1)
  })

  it('removes provider links on account deletion so the account cannot be re-entered', async () => {
    const first = await oauthSignup('google')
    const userId = (await me(first.client))?.id ?? ''
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(PASSWORD) },
    })
    const exported = await first.client.get('/api/me/export')
    expect(exported.body.data.user.oauthIdentities).toEqual([
      expect.objectContaining({ provider: 'GOOGLE', subject: google.sub }),
    ])

    const del = await first.client.post('/api/me/delete', { password: PASSWORD, confirm: 'DELETE' })
    expect(del.status).toBe(200)
    expect(await prisma.oAuthIdentity.count()).toBe(0)

    const again = await oauthSignup('google')
    const fresh = await me(again.client)
    expect(fresh?.id).toBeDefined()
    expect(fresh?.id).not.toBe(userId)
  })
})

describe('GitHub', () => {
  it('signs up with the verified primary email and minimal scopes', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'github', { intent: 'signup', acceptPrivacy: true })
    expect(authUrl.origin + authUrl.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(authUrl.searchParams.get('scope')).toBe('read:user user:email')
    expect(authUrl.searchParams.get('scope')).not.toMatch(/repo/)
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/oauth/github/callback`)

    const res = await complete(client, 'github', authUrl)
    expect(locationOf(res).pathname).toBe('/onboarding')
    const user = await me(client)
    expect(user?.email).toBe(`octo${seq}@example.test`)
    expect(user?.displayName).toBe('Octo Cat')
    expect(
      await prisma.oAuthIdentity.findFirstOrThrow({ where: { provider: 'GITHUB' } }),
    ).toMatchObject({ subject: String(github.id) })

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calledUrls).toEqual([GITHUB_TOKEN_URL, GITHUB_USER_URL, GITHUB_EMAILS_URL])
    const persisted = JSON.stringify([
      await prisma.oAuthAttempt.findMany(),
      await prisma.oAuthIdentity.findMany(),
      await prisma.user.findMany(),
    ])
    expect(persisted).not.toContain(GITHUB_ACCESS_TOKEN)
  })

  it('falls back to the login when the profile name is empty', async () => {
    github.name = null
    const { client } = await oauthSignup('github')
    expect((await me(client))?.displayName).toBe(github.login)
  })

  it.each([
    ['primary is unverified', [{ email: 'a@example.test', primary: true, verified: false }]],
    ['only a verified secondary', [{ email: 'b@example.test', primary: false, verified: true }]],
    ['no emails', []],
  ])('refuses when %s', async (_label, emails) => {
    github.emails = emails
    const { client, res } = await oauthSignup('github')
    expect(oauthError(res)).toBe('email_unverified')
    expect(await prisma.user.count()).toBe(0)
    expect(await me(client)).toBeNull()
  })

  it('fails safely when GitHub rejects the code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = await new Client().init()
    const authUrl = await start(client, 'github', { intent: 'signup', acceptPrivacy: true })
    const res = await client.get(
      callbackPath('github', {
        code: 'not-issued',
        state: authUrl.searchParams.get('state') ?? '',
      }),
    )
    expect(oauthError(res)).toBe('failed')
    expect(await prisma.user.count()).toBe(0)
  })
})

describe('state handling', () => {
  it('consumes a state exactly once', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const state = authUrl.searchParams.get('state') ?? ''
    expect(oauthError(await complete(client, 'google', authUrl))).toBeNull()

    const replay = await request(app)
      .get(callbackPath('google', { code: authorize('google', authUrl), state }))
      .set('Cookie', signedStateCookie(state))
    expect(oauthError(replay)).toBe('expired')
    expect(await prisma.session.count()).toBe(1)
  })

  it('rejects a state that does not match the browser cookie', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const res = await client.get(
      callbackPath('google', { code: authorize('google', authUrl), state: randomToken() }),
    )
    expect(oauthError(res)).toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await prisma.oAuthAttempt.findFirstOrThrow()).consumedAt).toBeNull()
  })

  it('rejects a callback from a different browser (no binding cookie)', async () => {
    const victim = await new Client().init()
    const authUrl = await start(victim, 'google', { intent: 'signup', acceptPrivacy: true })
    const attacker = await new Client().init()
    const res = await complete(attacker, 'google', authUrl)
    expect(oauthError(res)).toBe('expired')
    expect(await me(attacker)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a forged binding cookie', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const state = authUrl.searchParams.get('state') ?? ''
    const res = await request(app)
      .get(callbackPath('google', { code: authorize('google', authUrl), state }))
      .set('Cookie', `${OAUTH_COOKIE}=${state}.${'0'.repeat(64)}`)
    expect(oauthError(res)).toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an expired attempt without contacting the provider', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    await prisma.oAuthAttempt.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect(oauthError(await complete(client, 'google', authUrl))).toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.user.count()).toBe(0)
  })

  it('rejects a state issued for the other provider', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const res = await client.get(
      callbackPath('github', {
        code: authorize('github', authUrl),
        state: authUrl.searchParams.get('state') ?? '',
      }),
    )
    expect(oauthError(res)).toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ error: 'access_denied' }, 'cancelled'],
    [{ error: 'server_error' }, 'failed'],
    [{ code: 'abc', state: 'not-hex' }, 'expired'],
    [{ state: 'a'.repeat(64) }, 'expired'],
  ])('maps callback params %o to %s without leaking details', async (params, expected) => {
    const client = await new Client().init()
    await start(client, 'google', { intent: 'login' })
    const res = await client.get(callbackPath('google', params as Record<string, string>))
    const loc = locationOf(res)
    expect(loc.origin).toBe(APP)
    expect(loc.searchParams.get('oauth_error')).toBe(expected)
    expect([...loc.searchParams.keys()]).toEqual(['oauth_error'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a cancelled signup to /signup with next and consumes the attempt', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', {
      intent: 'signup',
      acceptPrivacy: true,
      next: '/projects/taskflow-lite',
    })
    const state = authUrl.searchParams.get('state') ?? ''
    const loc = locationOf(
      await client.get(callbackPath('google', { error: 'access_denied', state })),
    )
    expect(loc.origin).toBe(APP)
    expect(loc.pathname).toBe('/signup')
    expect(loc.searchParams.get('oauth_error')).toBe('cancelled')
    expect(loc.searchParams.get('next')).toBe('/projects/taskflow-lite')
    expect((await prisma.oAuthAttempt.findFirstOrThrow()).consumedAt).toBeInstanceOf(Date)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.user.count()).toBe(0)
    expect(await me(client)).toBeNull()

    const replay = await request(app)
      .get(callbackPath('google', { code: authorize('google', authUrl), state }))
      .set('Cookie', signedStateCookie(state))
    expect(oauthError(replay)).toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.user.count()).toBe(0)
  })

  it('ignores a denial whose state is not bound to this browser', async () => {
    const victim = await new Client().init()
    const authUrl = await start(victim, 'google', {
      intent: 'signup',
      acceptPrivacy: true,
      next: '/projects/taskflow-lite',
    })
    const state = authUrl.searchParams.get('state') ?? ''

    const forged = await victim.get(
      callbackPath('google', { error: 'access_denied', state: randomToken() }),
    )
    const attacker = await new Client().init()
    const crossBrowser = await attacker.get(
      callbackPath('google', { error: 'access_denied', state }),
    )
    for (const res of [forged, crossBrowser]) {
      const loc = locationOf(res)
      expect(loc.pathname).toBe('/login')
      expect(loc.searchParams.get('oauth_error')).toBe('cancelled')
      expect([...loc.searchParams.keys()]).toEqual(['oauth_error'])
    }
    expect((await prisma.oAuthAttempt.findFirstOrThrow()).consumedAt).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears the binding cookie on callback', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const res = await complete(client, 'google', authUrl)
    const cleared = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith(`${OAUTH_COOKIE}=;`))
    expect(cleared).toContain('Path=/api/auth/oauth')
  })
})

describe('signed-in sessions', () => {
  it('refuses to start a flow while signed in', async () => {
    const { client } = await signedUpClient()
    const res = await client.post('/api/auth/oauth/google/start', { intent: 'login' })
    expect(res.status).toBe(409)
    expect(await prisma.oAuthAttempt.count()).toBe(0)
  })

  it('never switches identity when the callback arrives in a signed-in browser', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const signup = await client.post('/api/auth/signup', {
      email: `password${seq}@example.test`,
      password: PASSWORD,
      displayName: 'Password User',
      acceptPrivacy: true,
    })
    const originalId = signup.body.data.user.id as string

    const res = await complete(client, 'google', authUrl)
    expect(oauthError(res)).toBe('already_signed_in')
    expect((await me(client))?.id).toBe(originalId)
    expect(await prisma.oAuthIdentity.count()).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('provider failures', () => {
  it('redirects with a generic error and logs nothing sensitive', async () => {
    tokenStatus = 500
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const code = authorize('google', authUrl)
    const res = await client.get(
      callbackPath('google', { code, state: authUrl.searchParams.get('state') ?? '' }),
    )

    expect(oauthError(res)).toBe('failed')
    expect(res.text).not.toMatch(/stack|Error:/)
    expect(errorSpy).toHaveBeenCalledWith('[oauth] provider step failed', {
      provider: 'google',
      step: 'token',
      reason: 'http',
      status: 500,
    })
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).not.toContain(code)
    expect(logged).not.toContain(GOOGLE.clientSecret)
    expect(logged).not.toContain(authUrl.searchParams.get('state') ?? '-')
  })

  it('handles a network failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    configureOAuth({
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const { client, res } = await oauthSignup('google')
    expect(oauthError(res)).toBe('failed')
    expect(await me(client)).toBeNull()
  })
})

describe('concurrency', () => {
  it('lets exactly one of two concurrent callbacks consume the same state', async () => {
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'signup', acceptPrivacy: true })
    const state = authUrl.searchParams.get('state') ?? ''
    const cookie = signedStateCookie(state)
    const hit = () =>
      request(app)
        .get(callbackPath('google', { code: authorize('google', authUrl), state }))
        .set('Cookie', cookie)

    const results = await Promise.all([hit(), hit()])
    expect(results.map((r) => oauthError(r)).sort()).toEqual(['expired', null])
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.session.count()).toBe(1)
  })

  it('creates a single account when the same new identity signs up twice at once', async () => {
    const a = await new Client().init()
    const b = await new Client().init()
    const urlA = await start(a, 'google', { intent: 'signup', acceptPrivacy: true })
    const urlB = await start(b, 'google', { intent: 'signup', acceptPrivacy: true })

    const results = await Promise.all([complete(a, 'google', urlA), complete(b, 'google', urlB)])
    expect(results.map((r) => oauthError(r))).toEqual([null, null])
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.oAuthIdentity.count()).toBe(1)
    expect((await me(a))?.id).toBe((await me(b))?.id)
  })
})

describe('safe next redirects', () => {
  it.each([
    [undefined, '/dashboard'],
    ['', '/dashboard'],
    ['dashboard', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['https://evil.example/x', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/\t/evil.example', '/dashboard'],
    ['/api/auth/logout', '/dashboard'],
    ['/projects/taskflow-lite?tab=1#top', '/projects/taskflow-lite?tab=1#top'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected)
  })

  it('never redirects off-site after a successful login', async () => {
    await oauthSignup('google')
    const client = await new Client().init()
    const authUrl = await start(client, 'google', { intent: 'login', next: '//evil.example/x' })
    const loc = locationOf(await complete(client, 'google', authUrl))
    expect(loc.origin).toBe(APP)
    expect(loc.pathname).toBe('/dashboard')
  })
})
