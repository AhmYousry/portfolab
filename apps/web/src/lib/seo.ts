import { BRAND } from '@pb/shared'
import { useEffect } from 'react'

const ROUTE_TITLES: Record<string, string> = {
  '/': `${BRAND.name} — ${BRAND.tagline}`,
  '/pricing': 'الأسعار',
  '/curriculum': 'المنهج',
  '/login': 'تسجيل الدخول',
  '/signup': 'ابدأ مجانًا',
  '/forgot-password': 'نسيت كلمة المرور',
  '/reset-password': 'كلمة مرور جديدة',
  '/onboarding': 'أهلًا بيك',
  '/dashboard': 'لوحتي',
  '/progress': 'التقدم',
  '/resources': 'الملفات',
  '/account': 'حسابي',
  '/checkout': `اشترك في ${BRAND.proTier}`,
  '/checkout/status': 'حالة الدفع',
  '/privacy': 'سياسة الخصوصية',
  '/terms': 'الشروط',
  '/refund-policy': 'سياسة الاسترجاع',
  '/contact': 'تواصل',
}

export function formatTitle(title?: string) {
  if (!title || title.startsWith(BRAND.name)) return title ?? `${BRAND.name} — ${BRAND.tagline}`
  return `${title} · ${BRAND.name}`
}

export function useRouteTitle(pathname: string) {
  useEffect(() => {
    const title = ROUTE_TITLES[pathname] ?? (pathname.startsWith('/admin') ? 'Admin' : undefined)
    if (title) document.title = formatTitle(title)
  }, [pathname])
}

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = formatTitle(title)
  }, [title])
}
