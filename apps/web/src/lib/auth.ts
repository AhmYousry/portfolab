import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublicUser } from '@pb/shared'
import { analytics } from './analytics'
import { api } from './api'
import { getConsent } from './consent'

export const ME_KEY = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<{ user: PublicUser | null }>('/api/auth/me').then((d) => d.user),
    staleTime: 60_000,
  })
}

export async function syncConsentToServer() {
  const consent = getConsent()
  if (!consent) return
  await api
    .put('/api/me/analytics-consent', { analytics: consent.analytics })
    .catch(() => undefined)
}

export function useAuthActions() {
  const qc = useQueryClient()
  return {
    setUser: (user: PublicUser | null) => qc.setQueryData(ME_KEY, user),
    signedIn: (user: PublicUser, method: 'signup' | 'login', source: string) => {
      qc.setQueryData(ME_KEY, user)
      analytics.identify(user)
      analytics.log('info', 'authentication_completed', { authentication_method: method })
      if (method === 'signup') analytics.capture('signup_completed', { source })
      else analytics.capture('login_completed', { source })
      void syncConsentToServer()
    },
    logout: async () => {
      await api.post('/api/auth/logout')
      analytics.log('info', 'session_logout_completed')
      analytics.reset()
      qc.setQueryData(ME_KEY, null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'public' })
    },
  }
}
