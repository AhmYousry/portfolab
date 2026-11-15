import { emailSchema } from '@pb/shared'
import { prisma } from '../db.js'

const email = emailSchema.safeParse(process.argv[2])
if (!email.success) {
  console.error('Usage: pnpm --filter @pb/api make-admin <email>')
  process.exit(1)
}

try {
  const user = await prisma.user.update({ where: { email: email.data }, data: { role: 'ADMIN' } })
  await prisma.auditLog.create({
    data: {
      action: 'role.grant_admin',
      objectType: 'user',
      objectId: user.id,
      detail: { via: 'cli' },
    },
  })
  console.info(`[admin] ${email.data} is now ADMIN`)
} catch {
  console.error('User not found')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
