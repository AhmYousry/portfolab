import { z } from 'zod'

export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE']
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH']
export const SORTS = ['createdAt', '-createdAt', 'dueDate', '-dueDate']

const TITLE_MAX = 120
const DESCRIPTION_MAX = 2000
const SEARCH_MAX = 100

const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'dueDate is not a real date')
  .nullable()

const taskFields = {
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable(),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  dueDate,
}

export const createTaskSchema = z
  .object({
    ...taskFields,
    description: taskFields.description.optional(),
    status: taskFields.status.default('TODO'),
    priority: taskFields.priority.default('MEDIUM'),
    dueDate: taskFields.dueDate.optional(),
  })
  .strict()

// No defaults here on purpose: a PATCH must only touch the fields the client sent.
export const updateTaskSchema = z
  .object(taskFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'send at least one field to update')

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().trim().max(SEARCH_MAX).optional(),
  sort: z.enum(SORTS).default('-createdAt'),
})

export const idSchema = z.string().min(1).max(40)
