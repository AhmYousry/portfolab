import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { Client, PASSWORD, resetDb, seedContent, signedUpClient } from './helpers.js'

beforeAll(async () => {
  await resetDb()
  await seedContent()
})

describe('account', () => {
  it('updates profile fields with validation and rejects unknown fields', async () => {
    const { client } = await signedUpClient()
    const ok = await client.patch('/api/me/profile', {
      displayName: 'Ahmed Dev',
      experienceLevel: 'JUNIOR',
      weeklyHours: 6,
      goal: 'JOB',
      githubUrl: 'https://github.com/someone/taskflow-lite',
    })
    expect(ok.status).toBe(200)
    expect(ok.body.data.user).toMatchObject({
      displayName: 'Ahmed Dev',
      goal: 'JOB',
      weeklyHours: 6,
    })

    expect((await client.patch('/api/me/profile', { role: 'ADMIN' })).status).toBe(400)
    expect(
      (await client.patch('/api/me/profile', { githubUrl: 'https://evil.example/x' })).status,
    ).toBe(400)
    expect((await client.patch('/api/me/profile', { weeklyHours: 500 })).status).toBe(400)
  })

  it('exports only the requesting user data, without secrets', async () => {
    const { client, email } = await signedUpClient()
    await signedUpClient({ email: 'other@example.test' })
    const res = await client.get('/api/me/export')
    expect(res.status).toBe(200)
    const text = JSON.stringify(res.body)
    expect(text).toContain(email)
    expect(text).not.toContain('other@example.test')
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('sessionTokenHash')
  })

  it('deletes (anonymizes) the account, revokes sessions and blocks login', async () => {
    const { client, email, userId } = await signedUpClient()
    expect(
      (await client.post('/api/me/delete', { password: 'wrong-password-x', confirm: 'DELETE' }))
        .status,
    ).toBe(400)
    expect((await client.post('/api/me/delete', { password: PASSWORD })).status).toBe(400)

    const res = await client.post('/api/me/delete', { password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.deletedAt).not.toBeNull()
    expect(user.email).not.toBe(email)
    expect(user.displayName).toBe('Deleted user')
    expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBe(0)

    const fresh = await new Client().init()
    expect((await fresh.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(401)
  })

  it('purchases list is empty and owner-scoped', async () => {
    const { client } = await signedUpClient()
    const res = await client.get('/api/me/purchases')
    expect(res.status).toBe(200)
    expect(res.body.data.purchases).toEqual([])
  })
})
