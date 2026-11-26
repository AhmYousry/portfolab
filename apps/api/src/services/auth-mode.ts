import type { AuthMode, OAuthProviderId } from '@pb/shared'
import { type Mailer, UnavailableMailer } from './mailer.js'
import { type NeonAuthConfig, type NeonAuthEnv, resolveNeonAuthConfig } from './neon-auth.js'
import { type OAuthConfig, resolveOAuthConfig } from './oauth.js'
import { type MailerEnv, createMailer, resolveMailerConfig } from './resend-mailer.js'

export class AuthModeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthModeConfigError'
  }
}

export interface AuthRuntimeEnv extends MailerEnv, Omit<NeonAuthEnv, 'NODE_ENV'> {
  AUTH_MODE: AuthMode
  APP_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

export interface AuthRuntime {
  mode: AuthMode
  mailer: Mailer
  oauth: OAuthConfig
  neon: NeonAuthConfig | null
}

// Validates the whole auth surface at boot. Social mode never touches mail configuration and
// gets an explicit failing mailer; password mode keeps the original mailer rules. Neon mode is an
// explicit opt-in: identity lives in Neon Auth, so local OAuth and mail are never enabled.
export function resolveAuthRuntime(input: AuthRuntimeEnv): AuthRuntime {
  if (input.AUTH_MODE === 'neon') {
    return {
      mode: 'neon',
      mailer: new UnavailableMailer(),
      oauth: {},
      neon: resolveNeonAuthConfig(input),
    }
  }
  const oauth = resolveOAuthConfig(input)
  if (input.AUTH_MODE === 'password') {
    return { mode: 'password', mailer: createMailer(resolveMailerConfig(input)), oauth, neon: null }
  }
  const configured = Object.keys(oauth) as OAuthProviderId[]
  if (input.NODE_ENV === 'production' && configured.length === 0) {
    throw new AuthModeConfigError(
      'AUTH_MODE=social requires at least one complete OAuth pair (GOOGLE_* or GITHUB_*) in production',
    )
  }
  return { mode: 'social', mailer: new UnavailableMailer(), oauth, neon: null }
}

let mode: AuthMode = 'password'

export function configureAuthMode(next: AuthMode) {
  mode = next
}

export function authMode(): AuthMode {
  return mode
}

export function passwordAuthEnabled(): boolean {
  return mode === 'password'
}

export function neonAuthEnabled(): boolean {
  return mode === 'neon'
}
