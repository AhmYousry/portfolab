import { describe, expect, it } from 'vitest'
import { analyticsEventSchema } from './analytics.js'
import { signupSchema, updateProfileSchema } from './schemas.js'

describe('signupSchema', () => {
  it('normalizes email and requires privacy acceptance', () => {
    const ok = signupSchema.parse({
      email: '  Ahmed@Example.COM ',
      password: 'long-enough-pass',
      displayName: 'Ahmed',
      acceptPrivacy: true,
    })
    expect(ok.email).toBe('ahmed@example.com')
    expect(
      signupSchema.safeParse({
        email: 'a@b.co',
        password: 'long-enough-pass',
        displayName: 'A B',
        acceptPrivacy: false,
      }).success,
    ).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('rejects role escalation and non-GitHub links', () => {
    expect(updateProfileSchema.safeParse({ role: 'ADMIN' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ githubUrl: 'https://example.com/x' }).success).toBe(
      false,
    )
    expect(updateProfileSchema.safeParse({ githubUrl: 'https://github.com/a/b' }).success).toBe(
      true,
    )
  })
})

describe('analyticsEventSchema', () => {
  it('only allows client-side events', () => {
    expect(analyticsEventSchema.safeParse({ event: 'landing_view' }).success).toBe(true)
    expect(analyticsEventSchema.safeParse({ event: 'purchase_confirmed' }).success).toBe(false)
  })
})
