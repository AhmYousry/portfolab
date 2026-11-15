import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublicUser } from '@pb/shared'
import { api } from './api'

export const ME_KEY = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<{ user: PublicUser | null }>('/api/auth/me').then((d) => d.user),
    staleTime: 60_000,
  })
}

export function useAuthActions() {
  const qc = useQueryClient()
  return {
    setUser: (user: PublicUser | null) => qc.setQueryData(ME_KEY, user),
    logout: async () => {
      await api.post('/api/auth/logout')
      qc.setQueryData(ME_KEY, null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'public' })
    },
  }
}
