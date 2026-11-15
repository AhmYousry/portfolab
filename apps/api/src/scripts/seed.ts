import { passwordSchema, emailSchema } from '@pb/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { hashPassword } from '../security/password.js'
import { importContent } from '../services/content-import.js'

async function seedAdmin() {
  const rawEmail = process.env.SEED_ADMIN_EMAIL
  const rawPassword = process.env.SEED_ADMIN_PASSWORD
  if (!rawEmail || !rawPassword) {
    console.info('[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; skipping admin user')
    return
  }
  const email = emailSchema.parse(rawEmail)
  const password = passwordSchema.parse(rawPassword)
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await hashPassword(password),
      displayName: 'Admin',
      role: 'ADMIN',
      privacyAcceptedAt: new Date(),
    },
    update: { role: 'ADMIN' },
  })
  console.info(`[seed] admin ready: ${email}`)
}

try {
  const report = await importContent({ contentDir: env.contentDir, syncStatus: true })
  console.info(`[seed] content ${JSON.stringify(report)}`)
  await seedAdmin()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
