import { prisma } from '../db.js'

export type ClaimEvent =
  | 'project_started'
  | 'lesson_started'
  | 'lesson_completed'
  | 'checkpoint_completed'
  | 'project_completed'
  | 'purchase_refunded'

// Atomically records that `event` happened for (userId, subject). Returns true only for the
// first caller; concurrent or repeated callers get false. INSERT … ON CONFLICT DO NOTHING on a
// composite primary key, so duplicates are neither errors nor log noise.
export async function claimOnce(
  event: ClaimEvent,
  userId: string,
  subject: string,
): Promise<boolean> {
  const result = await prisma.analyticsClaim.createMany({
    data: [{ event, userId, subject }],
    skipDuplicates: true,
  })
  return result.count === 1
}
