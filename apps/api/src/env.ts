import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const SESSION_SECRET_MIN = 32
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const optionalSecret = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).optional(),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  AUTH_MODE: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['password', 'social', 'neon']).default('password'),
  ),
  NEON_AUTH_BASE_URL: optionalSecret,
  NEON_AUTH_JWKS_URL: optionalSecret,
  NEON_AUTH_JWT_ISSUER: optionalSecret,
  NEON_AUTH_JWT_AUDIENCE: optionalSecret,
  NEON_AUTH_REQUIRE_EMAIL_VERIFIED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  WEB_DIST_DIR: optionalSecret,
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  APP_URL: z.url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(SESSION_SECRET_MIN),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CONTENT_DIR: z.string().default('../../content'),
  CHECKOUT_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  RATE_LIMIT_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  API_PUBLIC_URL: z.url().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.url().default('https://eu.i.posthog.com'),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(30).max(1825).default(395),
  MAIL_PROVIDER: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['console', 'resend']).optional(),
  ),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GITHUB_CLIENT_ID: optionalSecret,
  GITHUB_CLIENT_SECRET: optionalSecret,
  PAYMOB_BASE_URL: z.url().default('https://accept.paymob.com'),
  PAYMOB_SECRET_KEY: z.string().optional(),
  PAYMOB_PUBLIC_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_INTEGRATION_IDS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  PAYMOB_ALLOW_LIVE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

// Render injects its public URL; use it when APP_URL / CORS_ORIGINS are not set explicitly.
function withPlatformDefaults(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const platformUrl = source.RENDER_EXTERNAL_URL?.trim()
  if (!platformUrl) return source
  let origin: string
  try {
    origin = new URL(platformUrl).origin
  } catch {
    return source
  }
  return {
    ...source,
    APP_URL: source.APP_URL?.trim() || origin,
    CORS_ORIGINS: source.CORS_ORIGINS?.trim() || origin,
  }
}

const parsed = envSchema.safeParse(withPlatformDefaults(process.env))
if (!parsed.success) {
  const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  console.error(`Invalid environment configuration: ${fields}`)
  process.exit(1)
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.RATE_LIMIT_DISABLED) {
  console.error('RATE_LIMIT_DISABLED is not allowed in production')
  process.exit(1)
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  contentDir: path.resolve(apiRoot, parsed.data.CONTENT_DIR),
  webDistDir: parsed.data.WEB_DIST_DIR ? path.resolve(apiRoot, parsed.data.WEB_DIST_DIR) : null,
}
