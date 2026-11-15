import type { User } from '@prisma/client'
import type { PublicUser } from '@pb/shared'
import { prisma } from '../db.js'

export async function hasActivePro(userId: string): Promise<boolean> {
  const count = await prisma.entitlement.count({
    where: { userId, tier: 'PRO', revokedAt: null },
  })
  return count > 0
}

export async function toPublicUser(user: User): Promise<PublicUser> {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    role: user.role,
    experienceLevel: user.experienceLevel,
    weeklyHours: user.weeklyHours,
    goal: user.goal,
    githubUrl: user.githubUrl,
    hasPro: await hasActivePro(user.id),
    createdAt: user.createdAt.toISOString(),
  }
}
