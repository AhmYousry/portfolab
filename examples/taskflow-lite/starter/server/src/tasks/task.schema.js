import { z } from 'zod'

export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE']
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH']
export const SORTS = ['createdAt', '-createdAt', 'dueDate', '-dueDate']

// TODO (Module 3, lesson "validation"):
// createTaskSchema
//   - title: required, trimmed, 1..120 chars
//   - description: optional, nullable, max 2000
//   - status / priority: one of the lists above, with defaults
//   - dueDate: optional, nullable, "YYYY-MM-DD"
//   - reject unknown fields (.strict())
export const createTaskSchema = z.object({}).passthrough()

// TODO: updateTaskSchema
//   - every field optional, at least one field required
//   - careful: must NOT apply defaults (why? read the lesson's "common mistakes")
export const updateTaskSchema = z.object({}).passthrough()

// TODO: listQuerySchema for ?status=&priority=&search=&sort=
export const listQuerySchema = z.object({}).passthrough()

export const idSchema = z.string().min(1).max(40)
