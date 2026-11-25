import { BRAND } from '@pb/shared'

export interface EmailMessage {
  subject: string
  text: string
  html: string
}

export interface Mailer {
  sendPasswordReset(to: string, link: string): Promise<void>
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function passwordResetEmail(link: string): EmailMessage {
  const safeLink = escapeHtml(link)
  return {
    subject: `${BRAND.name} — إعادة تعيين كلمة المرور`,
    text: [
      `${BRAND.name}`,
      '',
      'طلبت إعادة تعيين كلمة المرور. افتح اللينك ده خلال 30 دقيقة:',
      link,
      '',
      'لو مش إنت اللي طلبت، تجاهل الرسالة دي وحسابك هيفضل زي ما هو.',
      '',
      `${BRAND.name} — ${BRAND.tagline}`,
    ].join('\n'),
    html: `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#080808;color:#f5f2ec;font-family:Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#101010;border:1px solid #262626;border-radius:16px">
<tr><td style="padding:32px">
<p dir="ltr" style="margin:0 0 24px;font-size:20px;font-weight:700;text-align:right">Portfo<span style="color:#f5a524">lab</span></p>
<p style="margin:0 0 16px;line-height:1.8">طلبت إعادة تعيين كلمة المرور. اللينك صالح لمدة 30 دقيقة ولمرة واحدة.</p>
<p style="margin:24px 0"><a href="${safeLink}" style="background:#f5a524;color:#080808;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">إعادة تعيين كلمة المرور</a></p>
<p style="margin:0;color:#a3a09a;font-size:13px;line-height:1.8">لو مش إنت اللي طلبت، تجاهل الرسالة دي.</p>
<p dir="ltr" style="margin:24px 0 0;color:#74716b;font-size:12px;text-align:right">${BRAND.name} — ${BRAND.tagline}</p>
</td></tr></table></td></tr></table></body></html>`,
  }
}

export type MailFailureReason = 'timeout' | 'network' | 'http' | 'unknown'

export class MailDeliveryError extends Error {
  constructor(
    readonly reason: Exclude<MailFailureReason, 'unknown'>,
    readonly status?: number,
  ) {
    super(`email delivery failed: ${reason}${status === undefined ? '' : ` (HTTP ${status})`}`)
    this.name = 'MailDeliveryError'
  }
}

export class ConsoleMailer implements Mailer {
  async sendPasswordReset(_to: string, link: string) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[mailer] No email provider configured; password reset email NOT sent.')
      return
    }
    if (process.env.NODE_ENV === 'test') return
    const message = passwordResetEmail(link)
    console.info(`[mailer:dev] ${message.subject}\n${message.text}`)
  }
}

export class MailUnavailableError extends Error {
  constructor() {
    super('email delivery is unavailable in this auth mode')
    this.name = 'MailUnavailableError'
  }
}

// Social-only mode has no mail provider. Anything that tries to send fails loudly instead of
// silently pretending (no console fallback).
export class UnavailableMailer implements Mailer {
  async sendPasswordReset(): Promise<void> {
    throw new MailUnavailableError()
  }
}

export let mailer: Mailer = new ConsoleMailer()

export function setMailer(m: Mailer) {
  mailer = m
}

const inFlight = new Set<Promise<void>>()

function describeFailure(err: unknown): { reason: MailFailureReason; status?: number } {
  if (!(err instanceof MailDeliveryError)) return { reason: 'unknown' }
  if (err.status === undefined) return { reason: err.reason }
  return { reason: err.reason, status: err.status }
}

export function dispatchPasswordReset(to: string, link: string): void {
  const task = Promise.resolve()
    .then(() => mailer.sendPasswordReset(to, link))
    .catch((err: unknown) => {
      console.error('[mailer] password reset delivery failed', describeFailure(err))
    })
    .finally(() => {
      inFlight.delete(task)
    })
  inFlight.add(task)
}

export async function drainMailDeliveries(): Promise<void> {
  await Promise.all([...inFlight])
}
