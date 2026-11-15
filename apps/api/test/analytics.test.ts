import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'
import { Client, PASSWORD, app, resetDb } from './helpers.js'

beforeAll(async () => {
  await resetDb()
})

describe('analytics ingest', () => {
  it('accepts allowlisted client events with UTM fields and stores no IP or user agent', async () => {
    const client = await new Client().init()
    const res = await client.post('/api/analytics/events', {
      event: 'landing_view',
      anonymousId: 'anon_12345678',
      path: '/',
      utm: { source: 'instagram', medium: 'reel', campaign: 'ahmed-17-calculators', content: 'v1' },
    })
    expect(res.status).toBe(202)
    const row = await prisma.leadEvent.findFirstOrThrow({ where: { anonymousId: 'anon_12345678' } })
    expect(row).toMatchObject({
      event: 'landing_view',
      utmSource: 'instagram',
      utmCampaign: 'ahmed-17-calculators',
    })
    expect(Object.keys(row)).not.toContain('ip')
    expect(Object.keys(row)).not.toContain('userAgent')
  })

  it.each([
    [{ event: 'purchase_confirmed' }],
    [{ event: 'signup_complete' }],
    [{ event: 'drop_table' }],
    [{ event: 'landing_view', path: 'https://evil.example' }],
    [{ event: 'landing_view', anonymousId: '<script>' }],
    [{ event: 'landing_view', utm: { source: 'x'.repeat(101) } }],
  ])('rejects server-only or malformed event %j', async (body) => {
    const client = await new Client().init()
    expect((await client.post('/api/analytics/events', body)).status).toBe(400)
  })

  it('requires CSRF like every other mutation', async () => {
    const res = await request(app).post('/api/analytics/events').send({ event: 'landing_view' })
    expect(res.status).toBe(403)
  })
})

describe('rate limiting', () => {
  afterAll(() => {
    env.RATE_LIMIT_DISABLED = true
  })

  it('limits repeated login attempts with 429', async () => {
    env.RATE_LIMIT_DISABLED = false
    const client = await new Client().init()
    let last = 0
    for (let i = 0; i < 25; i++) {
      const res = await client.post('/api/auth/login', {
        email: 'brute@example.test',
        password: PASSWORD,
      })
      last = res.status
      if (last === 429) break
    }
    expect(last).toBe(429)
  })
})
