import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'

const app = createApp()

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/health', () => {
  it('reports the database is up', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', database: 'up' })
  })
})
