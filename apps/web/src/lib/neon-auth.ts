import { createAuthClient } from '@neon/auth'
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters'
import type { NeonProof } from '@pb/shared'

function createManagedClient(url: string) {
  return createAuthClient(url, { adapter: BetterAuthVanillaAdapter() })
}

type NeonAuthClient = ReturnType<typeof createManagedClient>

// Bypasses the SDK's 60s session cache so the proof always reflects the current upstream session.
const FORCE_FETCH = { headers: { 'X-Force-Fetch': '1' } }
const JWT_SEGMENTS = 3
const TOKEN_ENDPOINT = '/token'

const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'الإيميل ده مستخدم قبل كده. جرب تسجل دخول.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'الإيميل ده مستخدم قبل كده. جرب تسجل دخول.',
  INVALID_EMAIL_OR_PASSWORD: 'الإيميل أو كلمة المرور غلط',
  INVALID_PASSWORD: 'كلمة المرور الحالية غلط',
  INVALID_EMAIL: 'الإيميل مش صحيح',
  PASSWORD_TOO_SHORT: 'كلمة المرور قصيرة جدًا',
  PASSWORD_TOO_LONG: 'كلمة المرور طويلة جدًا',
  EMAIL_NOT_VERIFIED: 'لازم تأكد إيميلك الأول. بص على الإيميل اللي وصلك.',
  EMAIL_VERIFICATION_PENDING: 'بعتنالك إيميل تأكيد. أكد إيميلك وبعدين ادخل.',
  TOO_MANY_REQUESTS: 'محاولات كتير. استنى شوية وجرب تاني.',
  NO_SESSION: 'مقدرناش نقرا جلسة الدخول. اتأكد إن المتصفح مش بيمنع الكوكيز للموقع ده وجرب تاني.',
}
const FALLBACK_MESSAGE = 'مقدرناش نكمل دلوقتي. جرب تاني بعد شوية.'
const RATE_LIMITED_STATUS = 429

export class NeonAuthError extends Error {
  constructor(readonly code: string) {
    super(MESSAGES[code] ?? FALLBACK_MESSAGE)
    this.name = 'NeonAuthError'
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined
}

// Errors arrive either as `{ error }` results or as thrown AuthHttpError (raw body on `.error`).
function codeOf(err: unknown): string {
  const raw = field(field(err, 'error'), 'code') ?? field(err, 'code')
  if (typeof raw === 'string' && raw in MESSAGES) return raw
  const status = field(field(err, 'error'), 'status') ?? field(err, 'status')
  if (status === RATE_LIMITED_STATUS) return 'TOO_MANY_REQUESTS'
  return typeof raw === 'string' ? raw : 'UNKNOWN'
}

async function call<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T> {
  let result: { data: T | null; error: unknown }
  try {
    result = await fn()
  } catch (err) {
    throw new NeonAuthError(codeOf(err))
  }
  if (result.error) throw new NeonAuthError(codeOf(result.error))
  if (result.data === null || result.data === undefined) throw new NeonAuthError('NO_SESSION')
  return result.data
}

let cached: { url: string; client: NeonAuthClient } | null = null

export function neonAuthClient(url: string): NeonAuthClient {
  if (cached?.url === url) return cached.client
  cached = { url, client: createManagedClient(url) }
  return cached.client
}

function isJwt(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === JWT_SEGMENTS
}

// The API verifies both values; nothing about the user is sent from here.
export async function readNeonProof(url: string): Promise<NeonProof> {
  const client = neonAuthClient(url)
  const data = await call(() => client.getSession({ fetchOptions: FORCE_FETCH }))
  const sessionId = data.session?.id
  if (!sessionId) throw new NeonAuthError('NO_SESSION')
  let token: unknown = data.session?.token
  if (!isJwt(token)) {
    const issued = await call(() =>
      client.$fetch<{ token: string }>(TOKEN_ENDPOINT, { method: 'GET', ...FORCE_FETCH }),
    )
    token = field(issued, 'token')
  }
  if (!isJwt(token)) throw new NeonAuthError('NO_SESSION')
  return { token, sessionId }
}

export async function neonSignUp(
  url: string,
  input: { email: string; password: string; name: string },
): Promise<NeonProof> {
  const client = neonAuthClient(url)
  const data = await call(() => client.signUp.email(input))
  if (!data.token) throw new NeonAuthError('EMAIL_VERIFICATION_PENDING')
  return readNeonProof(url)
}

export async function neonSignIn(
  url: string,
  input: { email: string; password: string },
): Promise<NeonProof> {
  const client = neonAuthClient(url)
  await call(() => client.signIn.email(input))
  return readNeonProof(url)
}

// Revokes every other upstream session; the caller must re-bridge with the returned proof.
export async function neonChangePassword(
  url: string,
  input: { currentPassword: string; newPassword: string },
): Promise<NeonProof> {
  const client = neonAuthClient(url)
  await call(() => client.changePassword({ ...input, revokeOtherSessions: true }))
  return readNeonProof(url)
}

export async function neonSignOut(url: string): Promise<void> {
  try {
    await neonAuthClient(url).signOut()
  } catch {
    return
  }
}
