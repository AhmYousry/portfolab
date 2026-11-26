import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import {
  AuthModeConfigError,
  configureAuthMode,
  resolveAuthRuntime,
} from '../src/services/auth-mode.js'
import {
  ConsoleMailer,
  MailUnavailableError,
  UnavailableMailer,
  dispatchPasswordReset,
  drainMailDeliveries,
  mailer as defaultMailer,
  setMailer,
} from '../src/services/mailer.js'
import { OAuthConfigError, configureOAuth } from '../src/services/oauth.js'
import { MailerConfigError, ResendMailer } from '../src/services/resend-mailer.js'
import { Client, PASSWORD, resetDb, signedUpClient } from './helpers.js'

const APP = 'https://portfolab-beta.onrender.com'
const GOOGLE = { GOOGLE_CLIENT_ID: 'g-id-FAKE', GOOGLE_CLIENT_SECRET: 'g-secret-FAKE' }
const GITHUB = { GITHUB_CLIENT_ID: 'gh-id-FAKE', GITHUB_CLIENT_SECRET: 'gh-secret-FAKE' }
const RESEND = {
  MAIL_PROVIDER: 'resend' as const,
  RESEND_API_KEY: 're_fakeTestKey_0123456789abcdef',
  EMAIL_FROM: 'Portfolab <no-reply@mail.portfolab-fake.dev>',
}
const PROD = { NODE_ENV: 'production' as const, APP_URL: APP }
const initialMailer = defaultMailer

function capture(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return null
}

describe('auth runtime configuration', () => {
  it('defaults to password mode with the original mailer rules', () => {
    const err = capture(() => resolveAuthRuntime({ ...PROD, AUTH_MODE: 'password' }))
    expect(err).toBeInstanceOf(MailerConfigError)

    const runtime = resolveAuthRuntime({ ...PROD, AUTH_MODE: 'password', ...RESEND })
    expect(runtime.mode).toBe('password')
    expect(runtime.mailer).toBeInstanceOf(ResendMailer)
  })

  it('keeps zero-config development on the console mailer', () => {
    const runtime = resolveAuthRuntime({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:5173',
      AUTH_MODE: 'password',
    })
    expect(runtime.mode).toBe('password')
    expect(runtime.mailer).toBeInstanceOf(ConsoleMailer)
    expect(runtime.oauth).toEqual({})
  })

  it('refuses social mode in production without a complete provider pair', () => {
    const none = capture(() => resolveAuthRuntime({ ...PROD, AUTH_MODE: 'social' }))
    expect(none).toBeInstanceOf(AuthModeConfigError)

    const partial = capture(() =>
      resolveAuthRuntime({
        ...PROD,
        AUTH_MODE: 'social',
        GOOGLE_CLIENT_ID: 'g-id-FAKE',
        GITHUB_CLIENT_SECRET: 'super-secret-value',
      }),
    )
    expect(partial).toBeInstanceOf(OAuthConfigError)
    expect(String(partial)).not.toContain('super-secret-value')
  })

  it('requires https for social mode in production', () => {
    const err = capture(() =>
      resolveAuthRuntime({
        NODE_ENV: 'production',
        APP_URL: 'http://portfolab-beta.onrender.com',
        AUTH_MODE: 'social',
        ...GITHUB,
      }),
    )
    expect(err).toBeInstanceOf(OAuthConfigError)
  })

  it('starts social mode with one pair, no mail settings, and an explicit unavailable mailer', () => {
    for (const pair of [GOOGLE, GITHUB]) {
      const runtime = resolveAuthRuntime({ ...PROD, AUTH_MODE: 'social', ...pair })
      expect(runtime.mode).toBe('social')
      expect(runtime.mailer).toBeInstanceOf(UnavailableMailer)
      expect(Object.keys(runtime.oauth)).toHaveLength(1)
    }
  })

  it('ignores mail settings in social mode instead of using them', () => {
    const runtime = resolveAuthRuntime({
      ...PROD,
      AUTH_MODE: 'social',
      ...GOOGLE,
      MAIL_PROVIDER: 'console',
    })
    expect(runtime.mailer).toBeInstanceOf(UnavailableMailer)
  })

  it('the unavailable mailer fails loudly and never prints the link', async () => {
    await expect(new UnavailableMailer().sendPasswordReset()).rejects.toBeInstanceOf(
      MailUnavailableError,
    )
    setMailer(new UnavailableMailer())
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    dispatchPasswordReset('student@example.test', 'http://x/reset-password?token=abc')
    await drainMailDeliveries()
    expect(error).toHaveBeenCalledWith('[mailer] password reset delivery failed', {
      reason: 'unknown',
    })
    expect(JSON.stringify([info.mock.calls, error.mock.calls])).not.toContain('token=abc')
    setMailer(initialMailer)
    vi.restoreAllMocks()
  })
})

describe('password endpoints in social mode', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    configureAuthMode('password')
    configureOAuth({ config: {} })
  })

  afterAll(() => {
    configureAuthMode('password')
  })

  it('explicitly disables signup, login, forgot, reset, and change password', async () => {
    const { client, email } = await signedUpClient()
    configureAuthMode('social')
    const anon = await new Client().init()

    const calls = [
      anon.post('/api/auth/signup', {
        email: 'new@example.test',
        password: PASSWORD,
        displayName: 'New User',
        acceptPrivacy: true,
      }),
      anon.post('/api/auth/login', { email, password: PASSWORD }),
      anon.post('/api/auth/forgot-password', { email }),
      anon.post('/api/auth/reset-password', { token: 'a'.repeat(64), password: PASSWORD }),
      client.post('/api/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: 'another-long-password',
      }),
    ]
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('PASSWORD_AUTH_DISABLED')
    }
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.passwordResetToken.count()).toBe(0)
    expect(await prisma.session.count()).toBe(1)
  })

  it('refuses password-based deletion in social mode', async () => {
    const { client, userId } = await signedUpClient()
    configureAuthMode('social')
    const res = await client.post('/api/me/delete', { password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PASSWORD_AUTH_DISABLED')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletedAt).toBeNull()
  })

  it('keeps the original password behavior in password mode', async () => {
    const { email } = await signedUpClient()
    const anon = await new Client().init()
    expect((await anon.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(200)
    expect((await anon.post('/api/auth/forgot-password', { email })).status).toBe(200)
  })
})

describe('auth capabilities discovery', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    configureAuthMode('password')
    configureOAuth({ config: {} })
  })

  it('reports the zero-config default', async () => {
    const res = await new Client().get('/api/auth/oauth/providers')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      mode: 'password',
      passwordAuth: true,
      providers: [],
      linkedProviders: null,
      neonAuthUrl: null,
    })
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('reports social mode, enabled providers, and only the viewer linked provider names', async () => {
    configureAuthMode('social')
    configureOAuth({
      config: {
        google: { clientId: 'g', clientSecret: 'g-secret' },
        github: { clientId: 'gh', clientSecret: 'gh-secret' },
      },
    })
    const anon = await new Client().get('/api/auth/oauth/providers')
    expect(anon.body.data).toEqual({
      mode: 'social',
      passwordAuth: false,
      providers: ['google', 'github'],
      linkedProviders: null,
      neonAuthUrl: null,
    })

    configureAuthMode('password')
    const { client, userId } = await signedUpClient()
    const other = await signedUpClient()
    configureAuthMode('social')
    await prisma.oAuthIdentity.create({
      data: { userId, provider: 'GITHUB', subject: 'gh-subject-secret-1' },
    })
    await prisma.oAuthIdentity.create({
      data: { userId: other.userId, provider: 'GOOGLE', subject: 'google-subject-secret-2' },
    })

    const mine = await client.get('/api/auth/oauth/providers')
    expect(mine.body.data.linkedProviders).toEqual(['github'])
    expect(mine.text).not.toContain('gh-subject-secret-1')
    expect(mine.headers['cache-control']).toContain('no-store')

    configureOAuth({ config: { google: { clientId: 'g', clientSecret: 'g-secret' } } })
    const disabled = await client.get('/api/auth/oauth/providers')
    expect(disabled.body.data.providers).toEqual(['google'])
    expect(disabled.body.data.linkedProviders).toEqual([])
  })
})
