import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { setMailer } from '../src/services/mailer.js'
import { Client, ORIGIN, PASSWORD, app, resetDb, signedUpClient } from './helpers.js'
import request from 'supertest'

beforeEach(async () => {
  await resetDb()
})

function sessionCookie(headers: Record<string, unknown>) {
  const cookies = (headers['set-cookie'] as string[] | undefined) ?? []
  return cookies.find((c) => c.startsWith('pb_session='))
}

describe('signup', () => {
  it('creates a user with an Argon2id hash and an HttpOnly session cookie', async () => {
    const client = await new Client().init()
    const res = await client.post('/api/auth/signup', {
      email: '  Ahmed@Example.TEST ',
      password: PASSWORD,
      displayName: 'Ahmed',
      acceptPrivacy: true,
    })
    expect(res.status).toBe(201)
    expect(res.body.data.user).toMatchObject({
      email: 'ahmed@example.test',
      role: 'STUDENT',
      hasPro: false,
    })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')

    const cookie = sessionCookie(res.headers)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ahmed@example.test' } })
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true)
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } })
    const token = cookie?.split(';')[0]?.split('=')[1] ?? ''
    expect(session.sessionTokenHash).not.toBe(token)
    expect(session.sessionTokenHash).toHaveLength(64)

    const me = await client.get('/api/auth/me')
    expect(me.body.data.user.email).toBe('ahmed@example.test')
  })

  it.each([
    [{ email: 'not-an-email', password: PASSWORD, displayName: 'A B', acceptPrivacy: true }],
    [{ email: 'a@example.test', password: 'short', displayName: 'A B', acceptPrivacy: true }],
    [{ email: 'a@example.test', password: PASSWORD, displayName: 'A B', acceptPrivacy: false }],
    [{ email: 'a@example.test', password: PASSWORD, displayName: 'A B' }],
  ])('rejects invalid signup %# with 400', async (body) => {
    const client = await new Client().init()
    const res = await client.post('/api/auth/signup', body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('rejects duplicate email with 409', async () => {
    const { email } = await signedUpClient()
    const client = await new Client().init()
    const res = await client.post('/api/auth/signup', {
      email,
      password: PASSWORD,
      displayName: 'Again',
      acceptPrivacy: true,
    })
    expect(res.status).toBe(409)
  })

  it('records a signup_complete event with UTM fields', async () => {
    const client = await new Client().init()
    await client.post('/api/auth/signup', {
      email: 'utm@example.test',
      password: PASSWORD,
      displayName: 'Utm user',
      acceptPrivacy: true,
      utm: { source: 'instagram', campaign: 'reel-01' },
    })
    const event = await prisma.leadEvent.findFirstOrThrow({ where: { event: 'signup_complete' } })
    expect(event).toMatchObject({ utmSource: 'instagram', utmCampaign: 'reel-01' })
  })
})

describe('login and logout', () => {
  it('logs in with correct password and rejects a wrong one with a generic message', async () => {
    const { email } = await signedUpClient()
    const client = await new Client().init()

    const bad = await client.post('/api/auth/login', { email, password: 'wrong-password-123' })
    expect(bad.status).toBe(401)
    const unknown = await client.post('/api/auth/login', {
      email: 'ghost@example.test',
      password: 'wrong-password-123',
    })
    expect(unknown.status).toBe(401)
    expect(unknown.body.error.message).toBe(bad.body.error.message)

    const good = await client.post('/api/auth/login', { email, password: PASSWORD })
    expect(good.status).toBe(200)
    expect(sessionCookie(good.headers)).toBeDefined()
  })

  it('logout revokes the session server-side, so a copied cookie stops working', async () => {
    const client = await new Client().init()
    const signup = await client.post('/api/auth/signup', {
      email: 'copy@example.test',
      password: PASSWORD,
      displayName: 'Copy cat',
      acceptPrivacy: true,
    })
    const copied = sessionCookie(signup.headers)?.split(';')[0] ?? ''
    expect(copied).toMatch(/^pb_session=[a-f0-9]{64}$/)

    const replayBefore = await request(app).get('/api/auth/me').set('Cookie', copied)
    expect(replayBefore.body.data.user).not.toBeNull()

    const res = await client.post('/api/auth/logout')
    expect(res.status).toBe(200)
    const session = await prisma.session.findFirstOrThrow({
      where: { user: { email: 'copy@example.test' } },
    })
    expect(session.revokedAt).not.toBeNull()

    const replayAfter = await request(app).get('/api/auth/me').set('Cookie', copied)
    expect(replayAfter.body.data.user).toBeNull()
    expect((await client.get('/api/me/dashboard')).status).toBe(401)
  })

  it('rejects expired sessions', async () => {
    const { client, userId } = await signedUpClient()
    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const me = await client.get('/api/auth/me')
    expect(me.body.data.user).toBeNull()
    expect((await client.get('/api/me/dashboard')).status).toBe(401)
  })

  it('ignores malformed session cookies', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'pb_session=../../etc/passwd')
    expect(res.status).toBe(200)
    expect(res.body.data.user).toBeNull()
  })
})

describe('CSRF and origin checks', () => {
  it('rejects mutations without a CSRF token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'a@example.test', password: 'x' })
    expect(res.status).toBe(403)
  })

  it('rejects a forged CSRF token', async () => {
    const client = await new Client().init()
    client.csrf = 'abc.def'
    const res = await client.post('/api/auth/login', { email: 'a@example.test', password: 'x' })
    expect(res.status).toBe(403)
  })

  it('rejects requests from a non-allowlisted origin', async () => {
    const client = await new Client().init()
    const res = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', client.csrf)
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@example.test', password: 'x' })
    expect(res.status).toBe(403)
  })
})

describe('password reset', () => {
  it('issues a single-use token, resets the password and revokes all sessions', async () => {
    const links: string[] = []
    setMailer({ sendPasswordReset: async (_to, link) => void links.push(link) })
    const { client, email, userId } = await signedUpClient()

    const anon = await new Client().init()
    const forgot = await anon.post('/api/auth/forgot-password', { email })
    expect(forgot.status).toBe(200)
    const ghost = await anon.post('/api/auth/forgot-password', { email: 'ghost@example.test' })
    expect(ghost.body).toEqual(forgot.body)
    expect(links).toHaveLength(1)

    const token = new URL(links[0] ?? '').searchParams.get('token') ?? ''
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId } })
    expect(stored.tokenHash).not.toBe(token)

    const newPassword = 'a-brand-new-password'
    const reset = await anon.post('/api/auth/reset-password', { token, password: newPassword })
    expect(reset.status).toBe(200)
    expect((await client.get('/api/me/dashboard')).status).toBe(401)

    const reuse = await anon.post('/api/auth/reset-password', {
      token,
      password: 'another-password-1',
    })
    expect(reuse.status).toBe(400)

    const login = await anon.post('/api/auth/login', { email, password: newPassword })
    expect(login.status).toBe(200)
  })

  it('rejects expired reset tokens', async () => {
    const links: string[] = []
    setMailer({ sendPasswordReset: async (_to, link) => void links.push(link) })
    const { email } = await signedUpClient()
    const anon = await new Client().init()
    await anon.post('/api/auth/forgot-password', { email })
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    const token = new URL(links[0] ?? '').searchParams.get('token') ?? ''
    const res = await anon.post('/api/auth/reset-password', {
      token,
      password: 'a-brand-new-password',
    })
    expect(res.status).toBe(400)
  })
})

describe('change password', () => {
  it('requires the current password and revokes other sessions', async () => {
    const { client, email } = await signedUpClient()
    const other = await new Client().init()
    await other.post('/api/auth/login', { email, password: PASSWORD })

    const wrong = await client.post('/api/auth/change-password', {
      currentPassword: 'nope-nope-nope',
      newPassword: 'another-good-password',
    })
    expect(wrong.status).toBe(400)

    const res = await client.post('/api/auth/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'another-good-password',
    })
    expect(res.status).toBe(200)
    expect((await client.get('/api/me/dashboard')).status).toBe(200)
    expect((await other.get('/api/me/dashboard')).status).toBe(401)
  })
})
