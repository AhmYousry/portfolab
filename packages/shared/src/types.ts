export type Tier = 'FREE' | 'PRO'
export type ContentStatus = 'DRAFT' | 'COMING_SOON' | 'PUBLISHED'
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
export type Role = 'STUDENT' | 'ADMIN'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiEnvelope<T> {
  data: T | null
  error: ApiError | null
  meta?: Record<string, unknown>
}

export interface PublicUser {
  id: string
  email: string
  displayName: string
  locale: string
  role: Role
  experienceLevel: string | null
  weeklyHours: number | null
  goal: string | null
  githubUrl: string | null
  hasPro: boolean
  createdAt: string
}

export interface ProjectSummary {
  slug: string
  title: string
  tagline: string
  description: string
  level: string
  tier: Tier
  status: ContentStatus
  estimatedHours: string
  order: number
  lessonCount: number
}

export interface CurriculumLesson {
  id: string
  slug: string
  title: string
  order: number
  durationMinutes: number
  isPreview: boolean
  checkpointCount: number
}

export interface CurriculumModule {
  id: string
  title: string
  description: string
  order: number
  lessons: CurriculumLesson[]
}

export interface ProjectDetail extends ProjectSummary {
  outcomes: string[]
  skills: string[]
  modules: CurriculumModule[]
}

export interface CheckpointView {
  id: string
  title: string
  instructions: string
  order: number
  completed: boolean
}

export interface LessonView {
  id: string
  slug: string
  title: string
  contentMarkdown: string
  durationMinutes: number
  isPreview: boolean
  module: { id: string; title: string; order: number }
  project: { slug: string; title: string; tier: Tier }
  checkpoints: CheckpointView[]
  progressStatus: ProgressStatus | null
  prev: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
}

export interface PricingTier {
  id: Tier
  name: string
  priceMinor: number
  currency: 'EGP'
  isTestPrice: boolean
  available: boolean
  checkoutEnabled: boolean
  includes: string[]
  projects: { slug: string; title: string; status: ContentStatus }[]
}

export interface ResourceView {
  id: string
  title: string
  description: string
  type: string
  tier: Tier
  projectSlug: string | null
  locked: boolean
  lockReason: string | null
}
