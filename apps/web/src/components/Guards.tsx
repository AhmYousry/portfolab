import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe } from '../lib/auth'
import { Container } from './Layout'
import { ErrorState, Loading } from './ui'

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { data: user, isLoading, isError, refetch } = useMe()
  const location = useLocation()

  if (isLoading) return <Loading />
  if (isError)
    return <ErrorState message="مش قادرين نتأكد من حسابك دلوقتي." onRetry={() => refetch()} />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (admin && user.role !== 'ADMIN') {
    return (
      <Container>
        <ErrorState message="الصفحة دي للأدمن بس." />
      </Container>
    )
  }
  return <>{children}</>
}

export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}
