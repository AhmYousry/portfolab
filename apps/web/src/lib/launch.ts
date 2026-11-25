import type { ContentStatus, Tier } from '@pb/shared'

export const FREE_PROJECT_SLUG = 'taskflow-lite'
export const FREE_PROJECT_PATH = `/projects/${FREE_PROJECT_SLUG}`

export const FREE_LAUNCH_BLOCKED_PATHS = [
  '/pricing',
  '/checkout',
  '/checkout/status',
  '/refund-policy',
] as const

export function isFreeLaunch(): boolean {
  return import.meta.env.VITE_FREE_LAUNCH === 'true'
}

type CatalogEntry = { tier: Tier; status: ContentStatus }

export function isFreeCatalogProject(project: CatalogEntry): boolean {
  return project.tier === 'FREE' && project.status === 'PUBLISHED'
}

export function visibleCatalog<T extends CatalogEntry>(projects: T[]): T[] {
  return isFreeLaunch() ? projects.filter(isFreeCatalogProject) : projects
}

export function visibleByTier<T extends { tier: Tier }>(items: T[]): T[] {
  return isFreeLaunch() ? items.filter((item) => item.tier === 'FREE') : items
}
