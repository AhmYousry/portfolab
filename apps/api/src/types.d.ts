import type { Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        displayName: string
        role: Role
        sessionId: string
      }
    }
  }
}

export {}
