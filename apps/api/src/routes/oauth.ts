import { Prisma, type OAuthAttempt, type OAuthProvider, type User } from '@prisma/client'
import { type Request, type Response, Router } from 'express'
import {
  type AuthCapabilities,
  OAUTH_PROVIDERS,
  type OAuthErrorCode,
  type OAuthProviderId,
  oauthStartSchema,
} from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { errors, ok, parse } from '../http.js'
import { hashPassword } from '../security/password.js'
import { oauthCallbackLimiter, oauthStartLimiter } from '../security/rate-limit.js'
import { createSession } from '../security/session.js'
import { hmac, randomToken, safeEqual, sha256 } from '../security/tokens.js'
import { issueDeletionGrant, setReauthCookie } from '../services/account-deletion.js'
import { track } from '../services/analytics.js'
import { authMode, neonAuthEnabled, passwordAuthEnabled } from '../services/auth-mode.js'
import { neonAuthConfig } from '../services/neon-auth.js'
import {
  OAuthFailure,
  type OAuthClient,
  type VerifiedProfile,
  appOrigin,
  authorizeUrl,
  enabledProviders,
  fetchVerifiedProfile,
  newCodeVerifier,
  newNonce,
  oauthClient,
} from '../services/oauth.js'

export const OAUTH_COOKIE = 'pb_oauth'
const OAUTH_COOKIE_PATH = '/api/auth/oauth'
const ATTEMPT_TTL_MS = 10 * 60 * 1000
const STATE_PATTERN = /^[a-f0-9]{64}$/
const CODE_MAX = 2048
const DEFAULT_NEXT = '/dashboard'
const REAUTH_PAGE = '/account'
const CONTROL_CHAR_MAX = 0x1f
const DEL_CHAR = 0x7f

const PROVIDER_ENUM: Record<OAuthProviderId, OAuthProvider> = {
  google: 'GOOGLE',
  github: 'GITHUB',
}

const PROVIDER_ID: Record<OAuthProvider, OAuthProviderId> = {
  GOOGLE: 'google',
  GITHUB: 'github',
}

type AuthPage = '/login' | '/signup'
type ReturnPage = AuthPage | typeof REAUTH_PAGE

export const oauthRouter = Router()

function isProvider(value: unknown): value is OAuthProviderId {
  return typeof value === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(value)
}

function enabledProvider(raw: unknown): OAuthProviderId | null {
  if (neonAuthEnabled() || !isProvider(raw) || !oauthClient(raw)) return null
  return raw
}

function hasControlChars(value: string) {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code <= CONTROL_CHAR_MAX || code === DEL_CHAR) return true
  }
  return false
}

export function safeNextPath(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_NEXT
  if (raw.includes('\\') || hasControlChars(raw)) return DEFAULT_NEXT
  const origin = appOrigin()
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return DEFAULT_NEXT
  }
  if (url.origin !== origin || url.pathname.startsWith('/api/')) return DEFAULT_NEXT
  return `${url.pathname}${url.search}${url.hash}`
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: OAUTH_COOKIE_PATH,
  }
}

function signState(state: string) {
  return `${state}.${hmac(env.SESSION_SECRET, `oauth-state:${state}`)}`
}

function readStateCookie(req: Request): string | null {
  const raw: unknown = req.cookies?.[OAUTH_COOKIE]
  if (typeof raw !== 'string') return null
  const [state, signature] = raw.split('.')
  if (!state || !signature || !STATE_PATTERN.test(state)) return null
  return safeEqual(signState(state), raw) ? state : null
}

function failureRedirect(page: ReturnPage, reason: OAuthErrorCode, next?: string) {
  if (page === REAUTH_PAGE) {
    return `${appOrigin()}${REAUTH_PAGE}?${new URLSearchParams({ reauth_error: reason })}`
  }
  const params = new URLSearchParams({ oauth_error: reason })
  if (next && next !== DEFAULT_NEXT) params.set('next', next)
  return `${appOrigin()}${page}?${params}`
}

function pageFor(reason: OAuthErrorCode, fallback: ReturnPage): ReturnPage {
  if (fallback === REAUTH_PAGE) return fallback
  if (reason === 'signup_required') return '/signup'
  if (reason === 'use_existing_method' || reason === 'account_unavailable') return '/login'
  return fallback
}

function pageForIntent(intent: string): ReturnPage {
  if (intent === 'reauth') return REAUTH_PAGE
  return intent === 'signup' ? '/signup' : '/login'
}

function queryString(req: Request, key: string): string {
  const value = req.query[key]
  return typeof value === 'string' ? value : ''
}

async function linkedProviders(userId: string, enabled: OAuthProviderId[]) {
  const rows = await prisma.oAuthIdentity.findMany({
    where: { userId },
    select: { provider: true },
  })
  const linked = new Set(rows.map((r) => PROVIDER_ID[r.provider]))
  return enabled.filter((p) => linked.has(p))
}

// Public discovery + auth capabilities. Linked provider names are added only for the signed-in
// viewer's own account; never identities, subjects, or emails.
oauthRouter.get('/providers', async (req, res) => {
  const providers = neonAuthEnabled() ? [] : enabledProviders()
  const capabilities: AuthCapabilities = {
    mode: authMode(),
    passwordAuth: passwordAuthEnabled(),
    providers,
    linkedProviders: req.user ? await linkedProviders(req.user.id, providers) : null,
    neonAuthUrl: neonAuthEnabled() ? (neonAuthConfig()?.baseUrl ?? null) : null,
  }
  res.setHeader('Cache-Control', 'private, no-store')
  ok(res, capabilities)
})

async function startReauth(
  req: Request,
  res: Response,
  provider: OAuthProviderId,
  client: OAuthClient,
) {
  const viewer = req.user
  if (!viewer) throw errors.unauthorized()
  const identity = await prisma.oAuthIdentity.findFirst({
    where: { userId: viewer.id, provider: PROVIDER_ENUM[provider] },
    select: { id: true },
  })
  if (!identity) throw errors.badRequest('حسابك مش مربوط بالطريقة دي. اختار الحساب اللي سجلت بيه.')

  const state = randomToken()
  const codeVerifier = newCodeVerifier()
  const nonce = newNonce()
  await prisma.oAuthAttempt.create({
    data: {
      stateHash: sha256(state),
      provider: PROVIDER_ENUM[provider],
      intent: 'reauth',
      codeVerifier,
      nonce,
      nextPath: REAUTH_PAGE,
      userId: viewer.id,
      sessionId: viewer.sessionId,
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    },
  })
  res.cookie(OAUTH_COOKIE, signState(state), { ...stateCookieOptions(), maxAge: ATTEMPT_TTL_MS })
  res.setHeader('Cache-Control', 'no-store')
  ok(res, { url: authorizeUrl(provider, client, { state, codeVerifier, nonce }) })
}

oauthRouter.post('/:provider/start', oauthStartLimiter, async (req, res) => {
  const provider = enabledProvider(req.params.provider)
  const client = provider ? oauthClient(provider) : undefined
  if (!provider || !client) throw errors.notFound('طريقة الدخول دي مش متاحة')
  const input = parse(oauthStartSchema, req.body)
  if (input.intent === 'reauth') {
    if (input.next !== undefined || input.acceptPrivacy !== undefined) throw errors.badRequest()
    await startReauth(req, res, provider, client)
    return
  }
  if (req.user) {
    throw errors.conflict('إنت مسجل دخول بالفعل. اخرج الأول لو عايز تستخدم حساب تاني.')
  }
  if (input.intent === 'signup' && input.acceptPrivacy !== true) {
    const message = 'لازم توافق على سياسة الخصوصية'
    throw errors.badRequest(message, [{ path: 'acceptPrivacy', message }])
  }

  const state = randomToken()
  const codeVerifier = newCodeVerifier()
  const nonce = newNonce()
  await prisma.oAuthAttempt.create({
    data: {
      stateHash: sha256(state),
      provider: PROVIDER_ENUM[provider],
      intent: input.intent,
      codeVerifier,
      nonce,
      nextPath: safeNextPath(input.next),
      privacyAccepted: input.intent === 'signup' && input.acceptPrivacy === true,
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    },
  })
  res.cookie(OAUTH_COOKIE, signState(state), { ...stateCookieOptions(), maxAge: ATTEMPT_TTL_MS })
  res.setHeader('Cache-Control', 'no-store')
  ok(res, { url: authorizeUrl(provider, client, { state, codeVerifier, nonce }) })
})

async function consumeAttempt(provider: OAuthProviderId, state: string): Promise<OAuthAttempt> {
  const now = new Date()
  const stateHash = sha256(state)
  const claimed = await prisma.oAuthAttempt.updateMany({
    where: {
      stateHash,
      provider: PROVIDER_ENUM[provider],
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  })
  if (claimed.count !== 1) throw new OAuthFailure('expired')
  return prisma.oAuthAttempt.findUniqueOrThrow({ where: { stateHash } })
}

async function consumeDeniedAttempt(
  provider: OAuthProviderId,
  state: string,
): Promise<OAuthAttempt | null> {
  try {
    return await consumeAttempt(provider, state)
  } catch (err) {
    if (err instanceof OAuthFailure) return null
    throw err
  }
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

function findIdentityUser(provider: OAuthProviderId, subject: string) {
  return prisma.oAuthIdentity.findUnique({
    where: { provider_subject: { provider: PROVIDER_ENUM[provider], subject } },
    include: { user: true },
  })
}

type IdentityWithUser = NonNullable<Awaited<ReturnType<typeof findIdentityUser>>>

async function existingLogin(identity: IdentityWithUser) {
  if (identity.user.deletedAt) throw new OAuthFailure('account_unavailable')
  await prisma.oAuthIdentity.update({
    where: { id: identity.id },
    data: { lastLoginAt: new Date() },
  })
  return { user: identity.user, created: false }
}

async function resolveUser(
  provider: OAuthProviderId,
  profile: VerifiedProfile,
  attempt: OAuthAttempt,
): Promise<{ user: User; created: boolean }> {
  const identity = await findIdentityUser(provider, profile.subject)
  if (identity) return existingLogin(identity)

  const collision = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true },
  })
  if (collision) {
    const raced = await findIdentityUser(provider, profile.subject)
    if (raced) return existingLogin(raced)
    throw new OAuthFailure('use_existing_method')
  }
  if (!attempt.privacyAccepted) throw new OAuthFailure('signup_required')

  const passwordHash = await hashPassword(randomToken())
  const now = new Date()
  try {
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        passwordHash,
        displayName: profile.displayName,
        privacyAcceptedAt: now,
        oauthIdentities: {
          create: { provider: PROVIDER_ENUM[provider], subject: profile.subject, lastLoginAt: now },
        },
      },
    })
    return { user, created: true }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const raced = await findIdentityUser(provider, profile.subject)
    if (!raced) throw new OAuthFailure('use_existing_method')
    return existingLogin(raced)
  }
}

function successRedirect(created: boolean, next: string) {
  if (created) return `${appOrigin()}/onboarding?next=${encodeURIComponent(next)}`
  return `${appOrigin()}${next}`
}

// Re-authentication only proves the signed-in user still controls the linked provider account.
// It never creates sessions, links identities, or switches accounts.
async function completeReauth(
  req: Request,
  res: Response,
  provider: OAuthProviderId,
  code: string,
  attempt: OAuthAttempt,
) {
  const viewer = req.user
  const sameSession =
    viewer !== undefined &&
    attempt.userId !== null &&
    attempt.sessionId !== null &&
    viewer.id === attempt.userId &&
    viewer.sessionId === attempt.sessionId
  if (!viewer || !sameSession) throw new OAuthFailure('session_changed')

  const profile = await fetchVerifiedProfile(provider, code, attempt)
  const identity = await prisma.oAuthIdentity.findUnique({
    where: { provider_subject: { provider: PROVIDER_ENUM[provider], subject: profile.subject } },
    select: { userId: true },
  })
  if (!identity || identity.userId !== viewer.id) throw new OAuthFailure('reauth_mismatch')

  const token = await issueDeletionGrant({
    userId: viewer.id,
    sessionId: viewer.sessionId,
    provider: PROVIDER_ENUM[provider],
  })
  if (!token) throw new OAuthFailure('session_changed')
  setReauthCookie(res, token)
}

async function handleCallback(req: Request, res: Response) {
  const provider = enabledProvider(req.params.provider)
  const cookieState = readStateCookie(req)
  res.clearCookie(OAUTH_COOKIE, stateCookieOptions())
  res.setHeader('Cache-Control', 'no-store')

  let page: ReturnPage = '/login'
  let next: string | undefined
  try {
    if (!provider) throw new OAuthFailure('failed')

    const state = queryString(req, 'state')
    const browserBound =
      STATE_PATTERN.test(state) && cookieState !== null && safeEqual(cookieState, state)

    const providerError = queryString(req, 'error')
    if (providerError) {
      const denied = browserBound ? await consumeDeniedAttempt(provider, state) : null
      if (denied) {
        page = pageForIntent(denied.intent)
        next = safeNextPath(denied.nextPath)
      }
      throw new OAuthFailure(providerError === 'access_denied' ? 'cancelled' : 'failed')
    }
    const code = queryString(req, 'code')
    if (!browserBound || !code || code.length > CODE_MAX) {
      throw new OAuthFailure(req.user ? 'already_signed_in' : 'expired')
    }

    const attempt = await consumeAttempt(provider, state)
    page = pageForIntent(attempt.intent)
    if (attempt.intent === 'reauth') {
      await completeReauth(req, res, provider, code, attempt)
      res.redirect(303, `${appOrigin()}${REAUTH_PAGE}?reauth=ok`)
      return
    }
    if (req.user) throw new OAuthFailure('already_signed_in')
    next = safeNextPath(attempt.nextPath)

    const profile = await fetchVerifiedProfile(provider, code, attempt)
    const { user, created } = await resolveUser(provider, profile, attempt)
    if (created) await track({ event: 'signup_complete', userId: user.id, utm: null })
    await createSession(req, res, user.id)
    res.redirect(303, successRedirect(created, next))
  } catch (err) {
    const reason: OAuthErrorCode = err instanceof OAuthFailure ? err.reason : 'failed'
    if (!(err instanceof OAuthFailure)) {
      console.error('[oauth] callback failed', {
        provider: provider ?? 'unknown',
        error: err instanceof Error ? err.name : 'unknown',
      })
    }
    res.redirect(303, failureRedirect(pageFor(reason, page), reason, next))
  }
}

oauthRouter.get('/:provider/callback', oauthCallbackLimiter, handleCallback)
