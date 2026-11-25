import { ConsoleMailer, MailDeliveryError, type Mailer, passwordResetEmail } from './mailer.js'

export const RESEND_ENDPOINT = 'https://api.resend.com/emails'
export const RESEND_TIMEOUT_MS = 10_000
const RESEND_TIMEOUT_MAX_MS = 15_000
const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{16,256}$/
const EMAIL_FROM_MAX_LENGTH = 320
const DISPLAY_NAME_MAX_LENGTH = 64
const DOMAIN_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?'
const ADDRESS_PATTERN = new RegExp(
  `^[A-Za-z0-9.!#$%&'*+/=?^_\`{|}~-]{1,64}@(${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+)$`,
)
const NAMED_SENDER_PATTERN = /^([^<>"]+?)\s*<([^<>\s]+)>$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const NON_DELIVERABLE_DOMAINS = ['resend.dev', 'example.com', 'example.org', 'example.net']
const NON_DELIVERABLE_TLDS = ['test', 'example', 'invalid', 'localhost', 'local']
const CONSOLE_IN_PROD = 'MAIL_PROVIDER=console is not allowed in production'
const UNVERIFIED_SENDER = 'EMAIL_FROM must use your own verified sending domain in production'

export type MailProvider = 'console' | 'resend'

export interface MailerEnv {
  NODE_ENV: 'development' | 'test' | 'production'
  MAIL_PROVIDER?: MailProvider
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
}

export type MailerConfig =
  | { provider: 'console' }
  | { provider: 'resend'; apiKey: string; from: string }

export class MailerConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid mailer configuration: ${issues.join('; ')}`)
    this.name = 'MailerConfigError'
  }
}

function senderDomain(from: string): string | null {
  if (from.length > EMAIL_FROM_MAX_LENGTH || CONTROL_CHARS.test(from)) return null
  const named = NAMED_SENDER_PATTERN.exec(from)
  if (named && (named[1]?.trim().length ?? 0) > DISPLAY_NAME_MAX_LENGTH) return null
  const address = named ? named[2] : from
  const match = ADDRESS_PATTERN.exec(address ?? '')
  return match?.[1]?.toLowerCase() ?? null
}

function isNonDeliverableDomain(domain: string): boolean {
  const tld = domain.split('.').at(-1) ?? ''
  return (
    NON_DELIVERABLE_TLDS.includes(tld) ||
    NON_DELIVERABLE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  )
}

export function resolveMailerConfig(input: MailerEnv): MailerConfig {
  const isProd = input.NODE_ENV === 'production'
  const provider = input.MAIL_PROVIDER ?? (isProd ? 'resend' : 'console')

  if (provider === 'console') {
    if (isProd) throw new MailerConfigError([CONSOLE_IN_PROD])
    return { provider: 'console' }
  }

  const apiKey = input.RESEND_API_KEY?.trim() ?? ''
  const from = input.EMAIL_FROM?.trim() ?? ''
  const issues = [apiKeyIssue(apiKey), senderIssue(from, isProd)].filter(
    (issue): issue is string => issue !== null,
  )
  if (issues.length > 0) throw new MailerConfigError(issues)
  return { provider: 'resend', apiKey, from }
}

function apiKeyIssue(apiKey: string): string | null {
  if (!apiKey) return 'RESEND_API_KEY is missing'
  if (!RESEND_API_KEY_PATTERN.test(apiKey)) return 'RESEND_API_KEY is malformed'
  return null
}

function senderIssue(from: string, isProd: boolean): string | null {
  if (!from) return 'EMAIL_FROM is missing'
  const domain = senderDomain(from)
  if (!domain) return 'EMAIL_FROM is malformed'
  if (isProd && isNonDeliverableDomain(domain)) return UNVERIFIED_SENDER
  return null
}

export interface ResendMailerOptions {
  apiKey: string
  from: string
  fetch?: typeof fetch
  timeoutMs?: number
}

function isAbort(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('name' in err)) return false
  return err.name === 'TimeoutError' || err.name === 'AbortError'
}

export class ResendMailer implements Mailer {
  private readonly apiKey: string
  private readonly from: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: ResendMailerOptions) {
    this.apiKey = options.apiKey
    this.from = options.from
    this.fetchImpl = options.fetch ?? fetch
    const requested = options.timeoutMs ?? RESEND_TIMEOUT_MS
    this.timeoutMs = Math.min(Math.max(1, Math.floor(requested)), RESEND_TIMEOUT_MAX_MS)
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    const message = passwordResetEmail(link)
    let response: Response
    try {
      response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      throw new MailDeliveryError(isAbort(err) ? 'timeout' : 'network')
    }
    await response.body?.cancel().catch(() => undefined)
    if (!response.ok) throw new MailDeliveryError('http', response.status)
  }
}

export function createMailer(config: MailerConfig, fetchImpl?: typeof fetch): Mailer {
  if (config.provider === 'console') return new ConsoleMailer()
  return new ResendMailer({
    apiKey: config.apiKey,
    from: config.from,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  })
}
