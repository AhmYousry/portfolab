import { describe, expect, it } from 'vitest'
import { analyticsEventSchema, sanitizeProperties, scrubUrl } from './analytics.js'
import { checkoutSessionSchema } from './schemas.js'

describe('sanitizeProperties', () => {
  it('keeps only allowlisted keys and drops PII-looking values', () => {
    expect(
      sanitizeProperties({
        project_id: 'taskflow-lite',
        amount_egp: 249,
        email: 'a@b.co',
        source: 'x@y.com',
        password: 'p',
        card: '4111111111111111',
        nested: { a: 1 },
      }),
    ).toEqual({ project_id: 'taskflow-lite', amount_egp: 249 })
  })
})

describe('scrubUrl', () => {
  it('redacts secrets in absolute and relative URLs', () => {
    expect(scrubUrl('/reset-password?token=abc&x=1')).toBe('/reset-password?token=REDACTED&x=1')
    expect(scrubUrl('https://a.test/p?clientSecret=s&hmac=h')).toBe(
      'https://a.test/p?clientSecret=REDACTED&hmac=REDACTED',
    )
    expect(scrubUrl('/plain')).toBe('/plain')
  })

  it('keeps only allowlisted query keys on /checkout/status (Paymob redirect params)', () => {
    const paymobRedirect =
      '/checkout/status?purchase=cm123&id=192036465&success=true&amount_cents=24900' +
      '&source_data.pan=2346&source_data.sub_type=MasterCard&order=217503754&hmac=abc'
    expect(scrubUrl(paymobRedirect)).toBe('/checkout/status?purchase=cm123')
    expect(scrubUrl(`https://portfolab.test${paymobRedirect}`)).toBe(
      'https://portfolab.test/checkout/status?purchase=cm123',
    )
    expect(scrubUrl('/checkout/status/?purchase=cm1&source_data.pan=1')).toBe(
      '/checkout/status/?purchase=cm1',
    )
    expect(scrubUrl('/projects/x?utm_source=ig')).toBe('/projects/x?utm_source=ig')
  })
})

describe('checkoutSessionSchema', () => {
  it('rejects client-supplied price fields', () => {
    const base = { firstName: 'A', lastName: 'B', phoneNumber: '+201000000000' }
    expect(checkoutSessionSchema.safeParse(base).success).toBe(true)
    expect(checkoutSessionSchema.safeParse({ ...base, amount: 1 }).success).toBe(false)
  })
})
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
