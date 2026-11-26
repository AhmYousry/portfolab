import { type JWTVerifyGetKey, createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose'
import { z } from 'zod'
import { type NeonErrorCode, displayNameSchema, emailSchema } from '@pb/shared'
import { prisma } from '../db.js'

// Managed Better Auth JWTs: EdDSA (Ed25519), 15-minute lifetime, no custom claims.
const JWT_ALGORITHMS = ['EdDSA']
const MAX_TOKEN_AGE = '15m'
const CLOCK_TOLERANCE_S = 5
const JWKS_PATH = '/.well-known/jwks.json'
const JWKS_TIMEOUT_MS = 5_000
const JWKS_COOLDOWN_MS = 30_000
const SUBJECT_MAX = 255
const DISPLAY_NAME_MAX = 60
const FALLBACK_DISPLAY_NAME = 'طالب Portfolab'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export class NeonAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeonAuthConfigError'
  }
}

export class NeonAuthFailure extends Error {
  constructor(readonly code: NeonErrorCode) {
    super(`neon auth failure: ${code}`)
    this.name = 'NeonAuthFailure'
  }
}

export interface NeonAuthConfig {
  baseUrl: string
  jwksUrl: string
  issuers: string[]
  audiences: string[]
  requireEmailVerified: boolean
}

export interface NeonAuthEnv {
  NODE_ENV: string
  APP_URL: string
  NEON_AUTH_BASE_URL?: string
  NEON_AUTH_JWKS_URL?: string
  NEON_AUTH_JWT_ISSUER?: string
  NEON_AUTH_JWT_AUDIENCE?: string
  NEON_AUTH_REQUIRE_EMAIL_VERIFIED?: boolean
}

function parseUrl(name: string, raw: string, production: boolean): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new NeonAuthConfigError(`${name} must be an absolute URL`)
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new NeonAuthConfigError(`${name} must not contain credentials, a query, or a fragment`)
  }
  const localDev = !production && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !localDev) {
    throw new NeonAuthConfigError(`${name} must use https`)
  }
  return url
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function csv(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Fails boot on anything ambiguous. Defaults follow Better Auth: iss and aud are the auth base URL;
// both the full Auth URL and its origin are accepted unless overridden explicitly.
export function resolveNeonAuthConfig(input: NeonAuthEnv): NeonAuthConfig {
  if (!input.NEON_AUTH_BASE_URL) {
    throw new NeonAuthConfigError('AUTH_MODE=neon requires NEON_AUTH_BASE_URL')
  }
  const production = input.NODE_ENV === 'production'
  const base = parseUrl('NEON_AUTH_BASE_URL', input.NEON_AUTH_BASE_URL, production)
  const baseUrl = withoutTrailingSlash(base.href)

  const jwksUrl = input.NEON_AUTH_JWKS_URL
    ? parseUrl('NEON_AUTH_JWKS_URL', input.NEON_AUTH_JWKS_URL, production).href
    : `${baseUrl}${JWKS_PATH}`
  if (new URL(jwksUrl).origin !== base.origin) {
    throw new NeonAuthConfigError('NEON_AUTH_JWKS_URL must be on the NEON_AUTH_BASE_URL origin')
  }

  if (production && new URL(input.APP_URL).protocol !== 'https:') {
    throw new NeonAuthConfigError('APP_URL must use https in production when AUTH_MODE=neon')
  }

  const defaults = [...new Set([baseUrl, base.origin])]
  const issuers = csv(input.NEON_AUTH_JWT_ISSUER)
  const audiences = csv(input.NEON_AUTH_JWT_AUDIENCE)
  return {
    baseUrl,
    jwksUrl,
    issuers: issuers.length > 0 ? issuers : defaults,
    audiences: audiences.length > 0 ? audiences : defaults,
    requireEmailVerified: input.NEON_AUTH_REQUIRE_EMAIL_VERIFIED === true,
  }
}

export interface UpstreamSession {
  createdAt: Date
  expiresAt: Date
}

export type UpstreamSessionLookup = (
  sessionId: string,
  subject: string,
) => Promise<UpstreamSession | null>

// Managed Auth keeps sessions in the branch's neon_auth schema. A signed-out, revoked, expired, or
// deleted-user session has no live row, so this is the revocation source of truth.
async function lookupNeonSession(
  sessionId: string,
  subject: string,
): Promise<UpstreamSession | null> {
  const rows = await prisma.$queryRaw<{ createdAt: Date; expiresAt: Date }[]>`
    SELECT s."createdAt" AS "createdAt", s."expiresAt" AS "expiresAt"
    FROM neon_auth."session" AS s
    WHERE s."id"::text = ${sessionId}
      AND s."userId"::text = ${subject}
      AND s."expiresAt" > now()
    LIMIT 1`
  const row = rows[0]
  if (!row) return null
  return { createdAt: new Date(row.createdAt), expiresAt: new Date(row.expiresAt) }
}

interface NeonAuthRuntime {
  config: NeonAuthConfig | null
  keys?: JWTVerifyGetKey
  lookupSession: UpstreamSessionLookup
}

let runtime: NeonAuthRuntime = { config: null, lookupSession: lookupNeonSession }

export function configureNeonAuth(patch: Partial<NeonAuthRuntime>) {
  const resetKeys = 'config' in patch && !('keys' in patch)
  runtime = { ...runtime, ...patch, ...(resetKeys ? { keys: undefined } : {}) }
}

export function neonAuthConfig(): NeonAuthConfig | null {
  return runtime.config
}

function signingKeys(config: NeonAuthConfig): JWTVerifyGetKey {
  runtime.keys ??= createRemoteJWKSet(new URL(config.jwksUrl), {
    timeoutDuration: JWKS_TIMEOUT_MS,
    cooldownDuration: JWKS_COOLDOWN_MS,
  })
  return runtime.keys
}

const claimsSchema = z.object({
  sub: z.string().min(1).max(SUBJECT_MAX),
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
  name: z.string().nullable().optional(),
})

export interface NeonClaims {
  subject: string
  email: string | null
  emailVerified: boolean
  displayName: string
}

function displayNameFrom(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const result = displayNameSchema.safeParse(candidate?.trim().slice(0, DISPLAY_NAME_MAX))
    if (result.success) return result.data
  }
  return FALLBACK_DISPLAY_NAME
}

// Signature (project JWKS, EdDSA only), issuer, audience, expiry, and age are all enforced. The
// payload is never read before verification succeeds.
export async function verifyNeonToken(token: string): Promise<NeonClaims> {
  const config = runtime.config
  if (!config) throw new NeonAuthFailure('NEON_AUTH_DISABLED')

  let payload: unknown
  try {
    const verified = await jwtVerify(token, signingKeys(config), {
      issuer: config.issuers,
      audience: config.audiences,
      algorithms: JWT_ALGORITHMS,
      requiredClaims: ['sub', 'exp', 'iat'],
      maxTokenAge: MAX_TOKEN_AGE,
      clockTolerance: CLOCK_TOLERANCE_S,
    })
    payload = verified.payload
  } catch (err) {
    const reason = err instanceof joseErrors.JOSEError ? err.code : 'unknown'
    console.warn('[neon-auth] token rejected', { reason })
    throw new NeonAuthFailure('NEON_TOKEN_INVALID')
  }

  const parsed = claimsSchema.safeParse(payload)
  if (!parsed.success) throw new NeonAuthFailure('NEON_TOKEN_INVALID')
  const claims = parsed.data
  const email = claims.email ? emailSchema.safeParse(claims.email) : null
  const normalized = email?.success ? email.data : null
  return {
    subject: claims.sub,
    email: normalized,
    emailVerified: claims.emailVerified === true,
    displayName: displayNameFrom(claims.name, normalized?.split('@')[0]),
  }
}

export function upstreamSession(sessionId: string, subject: string) {
  return runtime.lookupSession(sessionId, subject)
}

// Verified token + a live upstream session owned by the token's subject. Both are required.
export async function verifyNeonProof(proof: { token: string; sessionId: string }) {
  const claims = await verifyNeonToken(proof.token)
  const session = await upstreamSession(proof.sessionId, claims.subject)
  if (!session) throw new NeonAuthFailure('NEON_SESSION_INVALID')
  return { claims, session }
}
