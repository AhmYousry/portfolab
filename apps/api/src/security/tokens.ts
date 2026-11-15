import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_BYTES = 32

export function randomToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
