import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFreeLaunch, visibleByTier, visibleCatalog } from './launch'

const CATALOG = [
  { slug: 'taskflow-lite', tier: 'FREE', status: 'PUBLISHED' },
  { slug: 'free-draft', tier: 'FREE', status: 'COMING_SOON' },
  { slug: 'expensepilot', tier: 'PRO', status: 'COMING_SOON' },
  { slug: 'pro-live', tier: 'PRO', status: 'PUBLISHED' },
] as const

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('free launch toggle', () => {
  it('is off by default and keeps the full catalog', () => {
    vi.stubEnv('VITE_FREE_LAUNCH', '')
    expect(isFreeLaunch()).toBe(false)
    expect(visibleCatalog([...CATALOG])).toHaveLength(CATALOG.length)
    expect(visibleByTier([...CATALOG])).toHaveLength(CATALOG.length)
  })

  it('only accepts the exact string "true"', () => {
    vi.stubEnv('VITE_FREE_LAUNCH', '1')
    expect(isFreeLaunch()).toBe(false)
  })

  it('narrows the catalog to published free projects when enabled', () => {
    vi.stubEnv('VITE_FREE_LAUNCH', 'true')
    expect(isFreeLaunch()).toBe(true)
    expect(visibleCatalog([...CATALOG]).map((p) => p.slug)).toEqual(['taskflow-lite'])
    expect(visibleByTier([...CATALOG]).map((p) => p.slug)).toEqual(['taskflow-lite', 'free-draft'])
  })
})
