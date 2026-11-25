import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConsoleMailer,
  MailDeliveryError,
  dispatchPasswordReset,
  drainMailDeliveries,
  mailer as defaultMailer,
  setMailer,
} from '../src/services/mailer.js'
import {
  MailerConfigError,
  RESEND_ENDPOINT,
  ResendMailer,
  createMailer,
  resolveMailerConfig,
} from '../src/services/resend-mailer.js'

const API_KEY = 're_fakeTestKey_0123456789abcdef'
const FROM = 'Portfolab <no-reply@mail.portfolab-fake.dev>'
const TO = 'student@example.test'
const LINK = 'http://localhost:5173/reset-password?token=deadbeefcafe'
const MISSING_BOTH = ['RESEND_API_KEY is missing', 'EMAIL_FROM is missing']
const BAD_KEY = ['RESEND_API_KEY is malformed']
const BAD_FROM = ['EMAIL_FROM is malformed']
const initialMailer = defaultMailer

afterEach(() => {
  setMailer(initialMailer)
  vi.restoreAllMocks()
})

function configError(fn: () => unknown): MailerConfigError {
  try {
    fn()
  } catch (err) {
    if (err instanceof MailerConfigError) return err
    throw err
  }
  throw new Error('expected MailerConfigError')
}

describe('resolveMailerConfig', () => {
  it('defaults to the console mailer outside production without credentials', () => {
    expect(resolveMailerConfig({ NODE_ENV: 'development' })).toEqual({ provider: 'console' })
    expect(resolveMailerConfig({ NODE_ENV: 'test' })).toEqual({ provider: 'console' })
    expect(createMailer({ provider: 'console' })).toBeInstanceOf(ConsoleMailer)
  })

  it('does not switch to Resend in dev just because credentials exist', () => {
    const config = resolveMailerConfig({
      NODE_ENV: 'development',
      RESEND_API_KEY: API_KEY,
      EMAIL_FROM: FROM,
    })
    expect(config).toEqual({ provider: 'console' })
  })

  it('requires Resend in production and accepts valid config', () => {
    const config = resolveMailerConfig({
      NODE_ENV: 'production',
      RESEND_API_KEY: ` ${API_KEY} `,
      EMAIL_FROM: FROM,
    })
    expect(config).toEqual({ provider: 'resend', apiKey: API_KEY, from: FROM })
    expect(createMailer(config)).toBeInstanceOf(ResendMailer)
  })

  it('accepts a bare sender address and an Arabic display name', () => {
    for (const from of ['no-reply@portfolab-fake.dev', 'بورتفولاب <hi@portfolab-fake.dev>']) {
      expect(
        resolveMailerConfig({ NODE_ENV: 'production', RESEND_API_KEY: API_KEY, EMAIL_FROM: from }),
      ).toMatchObject({ provider: 'resend', from })
    }
  })

  it('rejects console mailer in production', () => {
    const err = configError(() =>
      resolveMailerConfig({ NODE_ENV: 'production', MAIL_PROVIDER: 'console' }),
    )
    expect(err.issues).toEqual(['MAIL_PROVIDER=console is not allowed in production'])
  })

  it.each([
    [{}, MISSING_BOTH],
    [{ RESEND_API_KEY: '   ', EMAIL_FROM: '' }, MISSING_BOTH],
    [{ RESEND_API_KEY: 'sk_live_not_resend_key_123456', EMAIL_FROM: FROM }, BAD_KEY],
    [{ RESEND_API_KEY: 're_short', EMAIL_FROM: FROM }, BAD_KEY],
    [{ RESEND_API_KEY: API_KEY, EMAIL_FROM: 'not-an-email' }, BAD_FROM],
    [{ RESEND_API_KEY: API_KEY, EMAIL_FROM: 'a@b.dev\r\nBcc: x@y.dev' }, BAD_FROM],
    [{ RESEND_API_KEY: API_KEY, EMAIL_FROM: 'Name <a@b.dev' }, BAD_FROM],
  ])('rejects missing/invalid production config %#', (vars, issues) => {
    const err = configError(() => resolveMailerConfig({ NODE_ENV: 'production', ...vars }))
    expect(err.issues).toEqual(issues)
  })

  it.each(['onboarding@resend.dev', 'Portfolab <no-reply@example.com>', 'no-reply@portfolab.test'])(
    'rejects unverifiable sender %s in production',
    (from) => {
      const err = configError(() =>
        resolveMailerConfig({ NODE_ENV: 'production', RESEND_API_KEY: API_KEY, EMAIL_FROM: from }),
      )
      expect(err.issues).toEqual([
        'EMAIL_FROM must use your own verified sending domain in production',
      ])
    },
  )

  it('allows the resend.dev test sender when Resend is opted into outside production', () => {
    expect(
      resolveMailerConfig({
        NODE_ENV: 'development',
        MAIL_PROVIDER: 'resend',
        RESEND_API_KEY: API_KEY,
        EMAIL_FROM: 'onboarding@resend.dev',
      }),
    ).toMatchObject({ provider: 'resend' })
  })

  it('never echoes secret or sender values in the error message', () => {
    const badKey = 'sk_secret_value_that_must_not_leak'
    const badFrom = 'leaky-sender-value'
    const err = configError(() =>
      resolveMailerConfig({ NODE_ENV: 'production', RESEND_API_KEY: badKey, EMAIL_FROM: badFrom }),
    )
    expect(err.message).not.toContain(badKey)
    expect(err.message).not.toContain(badFrom)
  })
})

function okResponse() {
  return new Response(JSON.stringify({ id: 'email_123' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ResendMailer', () => {
  it('POSTs the Arabic template to the fixed endpoint with bearer auth', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => okResponse())
    const resend = new ResendMailer({ apiKey: API_KEY, from: FROM, fetch: fetchMock })

    await resend.sendPasswordReset(TO, LINK)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(RESEND_ENDPOINT)
    expect(RESEND_ENDPOINT).toBe('https://api.resend.com/emails')
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`)
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['from', 'html', 'subject', 'text', 'to'])
    expect(body.from).toBe(FROM)
    expect(body.to).toEqual([TO])
    expect(body.subject).toContain('إعادة تعيين كلمة المرور')
    expect(body.text).toContain(LINK)
    expect(body.html).toContain('dir="rtl"')
    expect(body.html).toContain(LINK)
  })

  it.each([400, 401, 403, 422, 429, 500, 503])(
    'throws a sanitized http error on status %i',
    async (status) => {
      const leaky = JSON.stringify({ message: `bad recipient ${TO}`, key: API_KEY })
      const fetchMock = vi.fn<typeof fetch>(async () => new Response(leaky, { status }))
      const resend = new ResendMailer({ apiKey: API_KEY, from: FROM, fetch: fetchMock })

      const err = await resend.sendPasswordReset(TO, LINK).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(MailDeliveryError)
      expect(err).toMatchObject({ reason: 'http', status })
      const text = String((err as Error).message)
      expect(text).not.toContain(TO)
      expect(text).not.toContain(API_KEY)
      expect(text).not.toContain(LINK)
    },
  )

  it('maps network failures to a sanitized network error', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError(`getaddrinfo ENOTFOUND api.resend.com ${API_KEY}`)
    })
    const resend = new ResendMailer({ apiKey: API_KEY, from: FROM, fetch: fetchMock })
    const err = await resend.sendPasswordReset(TO, LINK).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MailDeliveryError)
    expect(err).toMatchObject({ reason: 'network' })
    expect(String((err as Error).message)).not.toContain(API_KEY)
  })

  it('aborts after the bounded timeout', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          signal?.addEventListener('abort', () => reject(signal.reason))
        }),
    )
    const resend = new ResendMailer({
      apiKey: API_KEY,
      from: FROM,
      fetch: fetchMock,
      timeoutMs: 25,
    })
    const started = Date.now()
    const err = await resend.sendPasswordReset(TO, LINK).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MailDeliveryError)
    expect(err).toMatchObject({ reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('dispatchPasswordReset', () => {
  it('logs only the failure class and status, never recipient, link or key', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setMailer({
      sendPasswordReset: async () => {
        throw new MailDeliveryError('http', 422)
      },
    })
    dispatchPasswordReset(TO, LINK)
    await drainMailDeliveries()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('[mailer] password reset delivery failed', {
      reason: 'http',
      status: 422,
    })
  })

  it('collapses unexpected errors to reason=unknown without their message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setMailer({
      sendPasswordReset: () => {
        throw new Error(`boom ${TO} ${LINK}`)
      },
    })
    dispatchPasswordReset(TO, LINK)
    await drainMailDeliveries()

    expect(errorSpy).toHaveBeenCalledWith('[mailer] password reset delivery failed', {
      reason: 'unknown',
    })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(TO)
  })
})
