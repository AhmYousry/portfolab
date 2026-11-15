export interface Mailer {
  sendPasswordReset(to: string, link: string): Promise<void>
}

class ConsoleMailer implements Mailer {
  async sendPasswordReset(_to: string, link: string) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[mailer] No email provider configured; password reset email NOT sent.')
      return
    }
    if (process.env.NODE_ENV === 'test') return
    console.info(`[mailer:dev] Password reset link: ${link}`)
  }
}

export let mailer: Mailer = new ConsoleMailer()

export function setMailer(m: Mailer) {
  mailer = m
}
