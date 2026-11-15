import { useQuery } from '@tanstack/react-query'
import type {
  LessonView,
  PricingTier,
  ProjectDetail,
  ProjectSummary,
  ResourceView,
} from '@pb/shared'
import { api } from './api'

export interface DashboardProject {
  project: { slug: string; title: string; tagline: string; tier: 'FREE' | 'PRO' }
  totalLessons: number
  completedLessons: number
  percent: number
  nextLesson: { slug: string; title: string; moduleTitle: string } | null
}

export interface ProgressProject extends DashboardProject {
  lessons: {
    id: string
    slug: string
    title: string
    moduleTitle: string
    moduleOrder: number
    status: string
  }[]
}

export const useProjects = () =>
  useQuery({
    queryKey: ['public', 'projects'],
    queryFn: () => api.get<{ projects: ProjectSummary[] }>('/api/projects').then((d) => d.projects),
  })

export const useProject = (slug: string) =>
  useQuery({
    queryKey: ['public', 'project', slug],
    queryFn: () =>
      api.get<{ project: ProjectDetail }>(`/api/projects/${slug}`).then((d) => d.project),
  })

export const usePricing = () =>
  useQuery({
    queryKey: ['public', 'pricing'],
    queryFn: () => api.get<{ tiers: PricingTier[] }>('/api/pricing').then((d) => d.tiers),
  })

export const useLesson = (slug: string, lessonSlug: string, userKey: string) =>
  useQuery({
    queryKey: ['lesson', slug, lessonSlug, userKey],
    queryFn: () =>
      api
        .get<{ lesson: LessonView }>(`/api/projects/${slug}/lessons/${lessonSlug}`)
        .then((d) => d.lesson),
    retry: false,
  })

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api.get<{ projects: DashboardProject[]; stats: { completedCheckpoints: number } }>(
        '/api/me/dashboard',
      ),
  })

export const useProgress = () =>
  useQuery({
    queryKey: ['progress'],
    queryFn: () =>
      api.get<{ projects: ProgressProject[] }>('/api/me/progress').then((d) => d.projects),
  })

export const useResources = () =>
  useQuery({
    queryKey: ['resources'],
    queryFn: () =>
      api.get<{ resources: ResourceView[] }>('/api/resources').then((d) => d.resources),
  })
