import type { Request, Response } from 'express'
import type { ZodType } from 'zod'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const errors = {
  badRequest: (message = 'طلب غير صالح', details?: unknown) =>
    new HttpError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'لازم تسجل دخول الأول') => new HttpError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'مش مسموح لك تشوف ده') => new HttpError(403, 'FORBIDDEN', message),
  notFound: (message = 'مش موجود') => new HttpError(404, 'NOT_FOUND', message),
  conflict: (message: string) => new HttpError(409, 'CONFLICT', message),
  passwordAuthDisabled: () =>
    new HttpError(
      403,
      'PASSWORD_AUTH_DISABLED',
      'الدخول بكلمة المرور مش متاح هنا. استخدم Google أو GitHub.',
    ),
}

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  res.status(status).json({ data, error: null, ...(meta ? { meta } : {}) })
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    throw errors.badRequest('البيانات المرسلة غير صالحة', details)
  }
  return result.data
}

export function requireUser(req: Request) {
  if (!req.user) throw errors.unauthorized()
  return req.user
}

export function requireAdmin(req: Request) {
  const user = requireUser(req)
  if (user.role !== 'ADMIN') throw errors.forbidden()
  return user
}

export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string' || value.length === 0) throw errors.badRequest()
  return value
}
