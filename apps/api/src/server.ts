import { createApp } from './app.js'
import { prisma } from './db.js'
import { env } from './env.js'
import { AuthModeConfigError, configureAuthMode, resolveAuthRuntime } from './services/auth-mode.js'
import { drainMailDeliveries, setMailer } from './services/mailer.js'
import { NeonAuthConfigError, configureNeonAuth } from './services/neon-auth.js'
import { OAuthConfigError, configureOAuth } from './services/oauth.js'
import { shutdownAnalytics } from './services/product-analytics.js'
import { MailerConfigError } from './services/resend-mailer.js'
import { scheduleRetention } from './services/retention.js'
import { WebDistError } from './web-static.js'

try {
  const runtime = resolveAuthRuntime(env)
  setMailer(runtime.mailer)
  configureOAuth({ config: runtime.oauth })
  configureNeonAuth({ config: runtime.neon })
  configureAuthMode(runtime.mode)
  console.info(`[api] auth mode: ${runtime.mode}`)
} catch (err) {
  const known =
    err instanceof MailerConfigError ||
    err instanceof OAuthConfigError ||
    err instanceof AuthModeConfigError ||
    err instanceof NeonAuthConfigError
  console.error(known ? err.message : 'Invalid auth configuration')
  process.exit(1)
}

let app: ReturnType<typeof createApp>
try {
  app = createApp({ webDistDir: env.webDistDir })
} catch (err) {
  console.error(err instanceof WebDistError ? err.message : 'Invalid web asset configuration')
  process.exit(1)
}

const server = app.listen(env.PORT, () => {
  console.info(`[api] listening on port ${env.PORT}`)
})

const stopRetention = scheduleRetention()

async function shutdown() {
  stopRetention()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await drainMailDeliveries()
  await shutdownAnalytics()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
