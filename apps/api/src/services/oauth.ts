import { createHash, randomBytes } from 'node:crypto'
import { type JWTVerifyGetKey, createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose'
import { z } from 'zod'
import {
  type OAuthErrorCode,
  type OAuthProviderId,
  displayNameSchema,
  emailSchema,
} from '@pb/shared'
import { env } from '../env.js'
import { safeEqual } from '../security/tokens.js'

const PKCE_VERIFIER_BYTES = 32
const NONCE_BYTES = 32
const DEFAULT_TIMEOUT_MS = 8_000
const DISPLAY_NAME_MAX = 60
const SUBJECT_MAX = 255
const FALLBACK_DISPLAY_NAME = 'طالب Portfolab'
const GITHUB_API_VERSION = '2022-11-28'
const USER_AGENT = 'Portfolab-OAuth'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const GOOGLE_SCOPES = 'openid email profile'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const GITHUB_SCOPES = 'read:user user:email'

export interface OAuthClient {
  clientId: string
  clientSecret: string
}

export type OAuthConfig = Partial<Record<OAuthProviderId, OAuthClient>>

export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthConfigError'
  }
}

export class OAuthFailure extends Error {
  constructor(readonly reason: OAuthErrorCode) {
    super(`oauth failure: ${reason}`)
    this.name = 'OAuthFailure'
  }
}

interface OAuthEnv {
  NODE_ENV: string
  APP_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

function pair(name: string, id: string | undefined, secret: string | undefined) {
  if (!id && !secret) return undefined
  if (!id || !secret) {
    throw new OAuthConfigError(`${name}_CLIENT_ID and ${name}_CLIENT_SECRET must be set together`)
  }
  return { clientId: id, clientSecret: secret }
}

export function resolveOAuthConfig(input: OAuthEnv): OAuthConfig {
  const config: OAuthConfig = {}
  const google = pair('GOOGLE', input.GOOGLE_CLIENT_ID, input.GOOGLE_CLIENT_SECRET)
  const github = pair('GITHUB', input.GITHUB_CLIENT_ID, input.GITHUB_CLIENT_SECRET)
  if (google) config.google = google
  if (github) config.github = github
  if (!google && !github) return config

  const appUrl = new URL(input.APP_URL)
  if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash) {
    throw new OAuthConfigError('APP_URL must be a bare origin when OAuth providers are enabled')
  }
  if (input.NODE_ENV === 'production' && appUrl.protocol !== 'https:') {
    throw new OAuthConfigError(
      'APP_URL must use https in production when OAuth providers are enabled',
    )
  }
  return config
}

interface OAuthRuntime {
  config: OAuthConfig
  fetch: typeof fetch
  googleKeys?: JWTVerifyGetKey
  timeoutMs: number
}

let runtime: OAuthRuntime = {
  config: {},
  fetch: (...args) => globalThis.fetch(...args),
  timeoutMs: DEFAULT_TIMEOUT_MS,
}

export function configureOAuth(patch: Partial<OAuthRuntime>) {
  runtime = { ...runtime, ...patch }
}

export function enabledProviders(): OAuthProviderId[] {
  const order: OAuthProviderId[] = ['google', 'github']
  return order.filter((p) => runtime.config[p])
}

export function oauthClient(provider: OAuthProviderId): OAuthClient | undefined {
  return runtime.config[provider]
}

function googleKeys(): JWTVerifyGetKey {
  runtime.googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))
  return runtime.googleKeys
}

export function appOrigin(): string {
  return new URL(env.APP_URL).origin
}

export function callbackUrl(provider: OAuthProviderId): string {
  return `${appOrigin()}/api/auth/oauth/${provider}/callback`
}

export function newCodeVerifier(): string {
  return randomBytes(PKCE_VERIFIER_BYTES).toString('base64url')
}

export function newNonce(): string {
  return randomBytes(NONCE_BYTES).toString('base64url')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function authorizeUrl(
  provider: OAuthProviderId,
  client: OAuthClient,
  params: { state: string; codeVerifier: string; nonce: string },
): string {
  const common = {
    client_id: client.clientId,
    redirect_uri: callbackUrl(provider),
    state: params.state,
    code_challenge: pkceChallenge(params.codeVerifier),
    code_challenge_method: 'S256',
  }
  if (provider === 'google') {
    const query = new URLSearchParams({
      ...common,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      nonce: params.nonce,
      prompt: 'select_account',
    })
    return `${GOOGLE_AUTHORIZE_URL}?${query}`
  }
  const query = new URLSearchParams({ ...common, scope: GITHUB_SCOPES, allow_signup: 'true' })
  return `${GITHUB_AUTHORIZE_URL}?${query}`
}

export interface VerifiedProfile {
  subject: string
  email: string
  displayName: string
}

function logFailure(provider: OAuthProviderId, step: string, detail: Record<string, unknown>) {
  console.error('[oauth] provider step failed', { provider, step, ...detail })
}

async function requestJson(
  provider: OAuthProviderId,
  step: string,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let res: Response
  try {
    res = await runtime.fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(runtime.timeoutMs),
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    logFailure(provider, step, { reason: timedOut ? 'timeout' : 'network' })
    throw new OAuthFailure('failed')
  }
  if (!res.ok) {
    logFailure(provider, step, { reason: 'http', status: res.status })
    throw new OAuthFailure('failed')
  }
  try {
    return await res.json()
  } catch {
    logFailure(provider, step, { reason: 'invalid_json' })
    throw new OAuthFailure('failed')
  }
}

function parseOrFail<T>(
  provider: OAuthProviderId,
  step: string,
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    logFailure(provider, step, { reason: 'unexpected_response' })
    throw new OAuthFailure('failed')
  }
  return result.data
}

function displayNameFrom(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const result = displayNameSchema.safeParse(candidate?.trim().slice(0, DISPLAY_NAME_MAX))
    if (result.success) return result.data
  }
  return FALLBACK_DISPLAY_NAME
}

function normalizeEmail(provider: OAuthProviderId, email: string): string {
  const result = emailSchema.safeParse(email)
  if (!result.success) {
    logFailure(provider, 'email', { reason: 'invalid_email' })
    throw new OAuthFailure('email_unverified')
  }
  return result.data
}

const googleTokenSchema = z.object({ id_token: z.string().min(1) })

const googleClaimsSchema = z.object({
  sub: z.string().min(1).max(SUBJECT_MAX),
  nonce: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  azp: z.string().optional(),
})

async function googleProfile(
  client: OAuthClient,
  code: string,
  attempt: { codeVerifier: string; nonce: string },
): Promise<VerifiedProfile> {
  const raw = await requestJson('google', 'token', GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      code_verifier: attempt.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl('google'),
    }),
  })
  const { id_token: idToken } = parseOrFail('google', 'token', googleTokenSchema, raw)

  let payload: unknown
  try {
    const verified = await jwtVerify(idToken, googleKeys(), {
      issuer: GOOGLE_ISSUERS,
      audience: client.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    })
    payload = verified.payload
  } catch (err) {
    const code = err instanceof joseErrors.JOSEError ? err.code : 'unknown'
    logFailure('google', 'id_token', { reason: code })
    throw new OAuthFailure('failed')
  }

  const claims = parseOrFail('google', 'id_token', googleClaimsSchema, payload)
  if (!safeEqual(claims.nonce, attempt.nonce)) {
    logFailure('google', 'id_token', { reason: 'nonce_mismatch' })
    throw new OAuthFailure('failed')
  }
  if (claims.azp !== undefined && claims.azp !== client.clientId) {
    logFailure('google', 'id_token', { reason: 'azp_mismatch' })
    throw new OAuthFailure('failed')
  }
  if (!claims.email || claims.email_verified !== true) throw new OAuthFailure('email_unverified')

  const email = normalizeEmail('google', claims.email)
  return {
    subject: claims.sub,
    email,
    displayName: displayNameFrom(claims.name, email.split('@')[0]),
  }
}

const githubTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
})

const githubUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
})

const githubEmailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
)

async function githubProfile(
  client: OAuthClient,
  code: string,
  attempt: { codeVerifier: string },
): Promise<VerifiedProfile> {
  const raw = await requestJson('github', 'token', GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      code_verifier: attempt.codeVerifier,
      redirect_uri: callbackUrl('github'),
    }),
  })
  const token = parseOrFail('github', 'token', githubTokenSchema, raw)
  if (token.token_type !== undefined && token.token_type.toLowerCase() !== 'bearer') {
    logFailure('github', 'token', { reason: 'token_type' })
    throw new OAuthFailure('failed')
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.access_token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': USER_AGENT,
  }
  const user = parseOrFail(
    'github',
    'user',
    githubUserSchema,
    await requestJson('github', 'user', GITHUB_USER_URL, { method: 'GET', headers }),
  )
  const emails = parseOrFail(
    'github',
    'emails',
    githubEmailsSchema,
    await requestJson('github', 'emails', GITHUB_EMAILS_URL, { method: 'GET', headers }),
  )
  const primary = emails.find((e) => e.primary && e.verified)
  if (!primary) throw new OAuthFailure('email_unverified')

  return {
    subject: String(user.id),
    email: normalizeEmail('github', primary.email),
    displayName: displayNameFrom(user.name, user.login),
  }
}

export async function fetchVerifiedProfile(
  provider: OAuthProviderId,
  code: string,
  attempt: { codeVerifier: string; nonce: string },
): Promise<VerifiedProfile> {
  const client = oauthClient(provider)
  if (!client) throw new OAuthFailure('failed')
  return provider === 'google'
    ? googleProfile(client, code, attempt)
    : githubProfile(client, code, attempt)
}
