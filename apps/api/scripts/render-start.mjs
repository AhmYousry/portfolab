// Single-service start for Render (no preDeployCommand on the free plan):
// 1. prisma migrate deploy (via DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED when set — Neon's non-pooled URL)
// 2. idempotent content import
// 3. the API + built web app in this same process
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { apiRoot, migrateDeploy, run } from './migrate-deploy.mjs'

migrateDeploy(process.env)
run('content import', [path.join('dist', 'scripts', 'import-content.js')], process.env)

await import(pathToFileURL(path.join(apiRoot, 'dist', 'server.js')).href)
