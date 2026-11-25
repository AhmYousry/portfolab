// `prisma migrate deploy` only (never migrate dev/reset). Runs against the direct (non-pooled) URL:
// DIRECT_DATABASE_URL, else DATABASE_URL_UNPOOLED (Neon's standard name), else DATABASE_URL.
// The pooled DATABASE_URL stays untouched for the runtime process.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prismaCli = path.join(apiRoot, 'node_modules', 'prisma', 'build', 'index.js')

export function resolveDirectUrl(env) {
  return env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL_UNPOOLED?.trim() || undefined
}

export function migrationEnv(env) {
  const directUrl = resolveDirectUrl(env)
  return directUrl ? { ...env, DATABASE_URL: directUrl } : env
}

export function run(label, args, env) {
  const result = spawnSync(process.execPath, args, { cwd: apiRoot, stdio: 'inherit', env })
  if (result.status !== 0) {
    console.error(`[migrate] ${label} failed`)
    process.exit(result.status ?? 1)
  }
}

function describeTarget(url) {
  try {
    return new URL(url).host
  } catch {
    return 'unparseable URL'
  }
}

export function migrateDeploy(env = process.env) {
  const migrateEnv = migrationEnv(env)
  if (!migrateEnv.DATABASE_URL?.trim()) {
    console.error(
      '[migrate] no database URL: set DATABASE_URL (+ DATABASE_URL_UNPOOLED or DIRECT_DATABASE_URL)',
    )
    process.exit(1)
  }
  const source = resolveDirectUrl(env) ? 'direct' : 'DATABASE_URL'
  console.log(
    `[migrate] prisma migrate deploy → ${describeTarget(migrateEnv.DATABASE_URL)} (${source})`,
  )
  run('prisma migrate deploy', [prismaCli, 'migrate', 'deploy'], migrateEnv)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  migrateDeploy()
}
