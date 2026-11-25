import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthCapabilities, PublicUser } from '@pb/shared'
import { useEffect, useRef } from 'react'
import { analytics } from './analytics'
import { api } from './api'
import { type ConsentState, getConsent } from './consent'

export const ME_KEY = ['me'] as const
export const AUTH_CAPABILITIES_KEY = ['auth-capabilities'] as const
const SYNC_ATTEMPTS = 3
const SYNC_BACKOFF_MS = 1500
const CAPABILITIES_STALE_MS = 5 * 60_000

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<{ user: PublicUser | null }>('/api/auth/me').then((d) => d.user),
    staleTime: 60_000,
  })
}

// Mode + enabled providers, plus the viewer's linked providers when signed in.
// Keyed by user so a sign-in/out never shows another state's linked providers.
export function useAuthCapabilities() {
  const { data: user } = useMe()
  return useQuery({
    queryKey: [...AUTH_CAPABILITIES_KEY, user?.id ?? null],
    queryFn: () => api.get<AuthCapabilities>('/api/auth/oauth/providers'),
    staleTime: CAPABILITIES_STALE_MS,
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function syncConsentToServer(attempts = SYNC_ATTEMPTS): Promise<boolean> {
  const consent = getConsent()
  if (!consent) return false
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await api.put('/api/me/analytics-consent', { analytics: consent.analytics })
      return true
    } catch {
      if (attempt < attempts) await wait(SYNC_BACKOFF_MS * attempt)
    }
  }
  return false
}

// The decision made on this device is authoritative for this device; the server flag mirrors the
// most recent decision so server-side events respect it. Re-sync whenever they disagree.
export function consentNeedsSync(local: ConsentState | null, user: PublicUser | null | undefined) {
  return Boolean(local && user && local.analytics !== user.analyticsConsent)
}

export function useConsentServerSync(user: PublicUser | null | undefined) {
  const qc = useQueryClient()
  const syncedFor = useRef<string | null>(null)
  useEffect(() => {
    const local = getConsent()
    if (!user || !consentNeedsSync(local, user)) return
    const key = `${user.id}:${String(local?.analytics)}`
    if (syncedFor.current === key) return
    syncedFor.current = key
    void syncConsentToServer().then((ok) => {
      if (ok && local)
        qc.setQueryData<PublicUser | null>(ME_KEY, { ...user, analyticsConsent: local.analytics })
    })
  }, [user, qc])
}

export function useAuthActions() {
  const qc = useQueryClient()
  return {
    setUser: (user: PublicUser | null) => qc.setQueryData(ME_KEY, user),
    signedIn: (user: PublicUser, method: 'signup' | 'login', source: string) => {
      qc.setQueryData(ME_KEY, user)
      analytics.identify(user)
      if (method === 'signup') analytics.capture('signup_completed', { source })
      else analytics.capture('login_completed', { source })
      void syncConsentToServer()
    },
    logout: async () => {
      await api.post('/api/auth/logout')
      analytics.capture('logged_out', { source: 'nav' })
      analytics.reset()
      qc.setQueryData(ME_KEY, null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'public' })
    },
  }
}
