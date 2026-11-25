import { z } from 'zod'
import { utmSchema } from './analytics.js'

const PASSWORD_MIN = 10
const PASSWORD_MAX = 128
const NAME_MAX = 60
const EMAIL_MAX = 254

export const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX).pipe(z.email())

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `كلمة المرور لازم تكون ${PASSWORD_MIN} حروف على الأقل`)
  .max(PASSWORD_MAX)

export const displayNameSchema = z.string().trim().min(2).max(NAME_MAX)

export const EXPERIENCE_LEVELS = ['NEW', 'SOME', 'JUNIOR'] as const
export const LEARNING_GOALS = ['PORTFOLIO', 'LEARNING', 'JOB'] as const
export const LOCALES = ['ar', 'en'] as const

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  acceptPrivacy: z.literal(true, 'لازم توافق على سياسة الخصوصية'),
  utm: utmSchema.optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
})

export const AUTH_MODES = ['password', 'social'] as const
export const OAUTH_PROVIDERS = ['google', 'github'] as const
export const OAUTH_INTENTS = ['login', 'signup', 'reauth'] as const
export const OAUTH_ERROR_CODES = [
  'cancelled',
  'failed',
  'expired',
  'email_unverified',
  'use_existing_method',
  'signup_required',
  'account_unavailable',
  'already_signed_in',
  'rate_limited',
  'reauth_mismatch',
  'session_changed',
] as const
const NEXT_PATH_MAX = 512

export const oauthStartSchema = z
  .object({
    intent: z.enum(OAUTH_INTENTS),
    next: z.string().max(NEXT_PATH_MAX).optional(),
    acceptPrivacy: z.boolean().optional(),
  })
  .strict()

export type AuthMode = (typeof AUTH_MODES)[number]
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number]

export interface AuthCapabilities {
  mode: AuthMode
  passwordAuth: boolean
  providers: OAuthProviderId[]
  linkedProviders: OAuthProviderId[] | null
}

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX),
  newPassword: passwordSchema,
})

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    locale: z.enum(LOCALES).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).nullable().optional(),
    weeklyHours: z.number().int().min(1).max(60).nullable().optional(),
    goal: z.enum(LEARNING_GOALS).nullable().optional(),
    githubUrl: z
      .url()
      .max(200)
      .refine((v) => v.startsWith('https://github.com/'), 'لازم يكون لينك GitHub')
      .nullable()
      .optional(),
  })
  .strict()

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX).optional(),
  confirm: z.literal('DELETE'),
})

export const PROGRESS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const

export const lessonProgressSchema = z.object({
  status: z.enum(PROGRESS_STATUSES),
})

export const checkpointProgressSchema = z.object({
  status: z.enum(['NOT_STARTED', 'COMPLETED']),
})

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const idSchema = z.string().min(1).max(40)

export const CONTENT_STATUSES = ['DRAFT', 'COMING_SOON', 'PUBLISHED'] as const

export const adminSetStatusSchema = z.object({
  status: z.enum(CONTENT_STATUSES),
  confirm: z.literal(true),
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const BILLING_NAME_MAX = 50

export const checkoutSessionSchema = z
  .object({
    firstName: z.string().trim().min(1).max(BILLING_NAME_MAX),
    lastName: z.string().trim().min(1).max(BILLING_NAME_MAX),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, 'رقم الموبايل لازم يكون أرقام بس (10–15 رقم)'),
    source: z.string().trim().max(40).default('checkout_page'),
  })
  .strict()

export const analyticsConsentSchema = z.object({ analytics: z.boolean() }).strict()

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
