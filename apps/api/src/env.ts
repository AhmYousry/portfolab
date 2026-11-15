import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const SESSION_SECRET_MIN = 32
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
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
})

const parsed = envSchema.safeParse(process.env)
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
}
