import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { migrationEnv, resolveDirectUrl } from '../scripts/migrate-deploy.mjs'

const POOLED = 'postgresql://u:p@ep-x-pooler.region.aws.neon.tech/db?sslmode=require'
const UNPOOLED = 'postgresql://u:p@ep-x.region.aws.neon.tech/db?sslmode=require'
const DIRECT = 'postgresql://u:p@direct.example.test/db'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPkg = JSON.parse(readFileSync(path.join(apiRoot, 'package.json'), 'utf8'))
const rootPkg = JSON.parse(readFileSync(path.join(apiRoot, '..', '..', 'package.json'), 'utf8'))
const ENV_CHAIN =
  '--env-file-if-exists=.env --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local '

describe('migration database URL', () => {
  it('prefers DIRECT_DATABASE_URL, then DATABASE_URL_UNPOOLED', () => {
    expect(resolveDirectUrl({ DIRECT_DATABASE_URL: DIRECT, DATABASE_URL_UNPOOLED: UNPOOLED })).toBe(
      DIRECT,
    )
    expect(resolveDirectUrl({ DIRECT_DATABASE_URL: '  ', DATABASE_URL_UNPOOLED: UNPOOLED })).toBe(
      UNPOOLED,
    )
    expect(resolveDirectUrl({ DATABASE_URL: POOLED })).toBeUndefined()
  })

  it('swaps DATABASE_URL only in the migration env, never the input env', () => {
    const env = { DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: UNPOOLED }
    expect(migrationEnv(env).DATABASE_URL).toBe(UNPOOLED)
    expect(env.DATABASE_URL).toBe(POOLED)
  })

  it('falls back to DATABASE_URL when no direct URL is set', () => {
    const env = { DATABASE_URL: POOLED }
    expect(migrationEnv(env)).toBe(env)
  })
})

describe('env file loading', () => {
  it.each([
    'dev',
    'start',
    'neon:migrate',
    'db:seed',
    'content:import',
    'make-admin',
    'payments:reconcile',
    'analytics:purge',
  ])('%s loads apps/api/.env, root .env, root .env.local in order', (name) => {
    expect(apiPkg.scripts[name]).toContain(ENV_CHAIN)
  })

  it('neon:migrate only ever runs migrate deploy', () => {
    const source = readFileSync(path.join(apiRoot, 'scripts', 'migrate-deploy.mjs'), 'utf8')
    expect(source).toContain("'migrate', 'deploy'")
    expect(source).not.toMatch(/'migrate', '(dev|reset)'/)
    expect(source).not.toContain('--force')
  })

  it('tests never load root env files', () => {
    expect(apiPkg.scripts.test).not.toContain('env-file')
    expect(apiPkg.scripts['dev:local']).not.toContain('../../.env')
    const pw = readFileSync(path.join(apiRoot, '..', '..', 'playwright.config.ts'), 'utf8')
    expect(pw).toContain("'pnpm --filter @pb/api dev:local'")
    expect(pw).toMatch(
      /command: 'pnpm --filter @pb\/api dev:local',\s*url: '[^']+',\s*reuseExistingServer: false,/,
    )
  })

  it('root render:start loads root .env then .env.local', () => {
    expect(rootPkg.scripts['render:start']).toBe(
      'node --env-file-if-exists=.env --env-file-if-exists=.env.local apps/api/scripts/render-start.mjs',
    )
  })
})
