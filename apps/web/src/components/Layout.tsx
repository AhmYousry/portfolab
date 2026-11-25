import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { type AnalyticsId, BRAND } from '@pb/shared'
import { useAuthActions, useConsentServerSync, useMe } from '../lib/auth'
import { trackClick, useAnalyticsRouting } from '../lib/analytics'
import { FREE_LAUNCH_BLOCKED_PATHS, isFreeLaunch } from '../lib/launch'
import { useRouteTitle } from '../lib/seo'
import { BrandWordmark } from './Brand'
import { ConsentBanner, openConsentSettings } from './ConsentBanner'

interface NavItem {
  to: string
  label: string
  id: AnalyticsId
}

const PUBLIC_LINKS: NavItem[] = [
  { to: '/curriculum', label: 'المنهج', id: 'nav-curriculum' },
  { to: '/pricing', label: 'الأسعار', id: 'nav-pricing' },
]

const STUDENT_LINKS: NavItem[] = [
  { to: '/dashboard', label: 'لوحتي', id: 'nav-dashboard' },
  { to: '/progress', label: 'التقدم', id: 'nav-progress' },
  { to: '/resources', label: 'الملفات', id: 'nav-resources' },
]

const FOOTER_LINKS: NavItem[] = [
  { to: '/privacy', label: 'الخصوصية', id: 'footer-privacy' },
  { to: '/terms', label: 'الشروط', id: 'footer-terms' },
  { to: '/refund-policy', label: 'الاسترجاع', id: 'footer-refund' },
  { to: '/contact', label: 'تواصل', id: 'footer-contact' },
]

const BLOCKED_PATHS: readonly string[] = FREE_LAUNCH_BLOCKED_PATHS

function launchLinks(items: NavItem[]) {
  return isFreeLaunch() ? items.filter((l) => !BLOCKED_PATHS.includes(l.to)) : items
}

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'text-paper bg-white/5' : 'text-muted hover:text-paper'}`
}

function tracked(id: AnalyticsId) {
  return { 'data-analytics-id': id, onClick: () => trackClick(id) }
}

export function Layout() {
  const { data: user } = useMe()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useAnalyticsRouting(location.pathname, location.search, user)
  useConsentServerSync(user)
  useRouteTitle(location.pathname)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  const links = launchLinks([...PUBLIC_LINKS, ...(user ? STUDENT_LINKS : [])])
  const footerLinks = launchLinks(FOOTER_LINKS)

  async function handleLogout() {
    trackClick('nav-logout')
    // Leave protected pages first; clearing the user there would trigger the auth guard's
    // redirect to /login?next=… before we could navigate home.
    navigate('/', { replace: true })
    await logout()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="grain" aria-hidden />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-lg focus:bg-amber focus:px-4 focus:py-2 focus:text-ink"
      >
        تخطى للمحتوى
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
          aria-label="القائمة الرئيسية"
        >
          <Link to="/" aria-label="Portfolab — الرئيسية" {...tracked('nav-logo')}>
            <BrandWordmark />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass} {...tracked(l.id)}>
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={navClass} {...tracked('nav-admin')}>
                Admin
              </NavLink>
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NavLink
                  to="/account"
                  className={(s) => `${navClass(s)} ph-no-capture ph-mask`}
                  {...tracked('nav-account')}
                >
                  {user.displayName}
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-muted hover:text-paper"
                  aria-label="تسجيل الخروج"
                  data-analytics-id="nav-logout"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass} {...tracked('nav-login')}>
                  دخول
                </NavLink>
                <Link
                  to="/signup"
                  className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber-2"
                  {...tracked('nav-signup')}
                >
                  ابدأ مجانًا
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => {
              if (!open) trackClick('nav-menu-toggle')
              setOpen((v) => !v)
            }}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'اقفل القائمة' : 'افتح القائمة'}
            data-analytics-id="nav-menu-toggle"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </nav>
        {open && (
          <div id="mobile-nav" className="border-t border-line px-4 pb-4 md:hidden">
            <div className="flex flex-col gap-1 pt-3">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={navClass} {...tracked(l.id)}>
                  {l.label}
                </NavLink>
              ))}
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin" className={navClass} {...tracked('nav-admin')}>
                  Admin
                </NavLink>
              )}
              {user ? (
                <>
                  <NavLink to="/account" className={navClass} {...tracked('nav-account')}>
                    حسابي
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg px-3 py-2 text-start text-sm text-muted"
                    data-analytics-id="nav-logout"
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass} {...tracked('nav-login')}>
                    دخول
                  </NavLink>
                  <NavLink to="/signup" className={navClass} {...tracked('nav-signup')}>
                    ابدأ مجانًا
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line/70 py-10 text-sm text-dim">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p>
              <span dir="ltr">
                {BRAND.name} — {BRAND.tagline}
              </span>
            </p>
            <p>
              محتوى تعليمي أصلي، ومفيش أي ضمان توظيف. من صناع سلسلة {BRAND.series} على Instagram.
            </p>
          </div>
          <nav className="flex flex-wrap gap-4" aria-label="روابط قانونية">
            {footerLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-paper" {...tracked(l.id)}>
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                trackClick('footer-privacy-settings')
                openConsentSettings()
              }}
              className="hover:text-paper"
              data-analytics-id="footer-privacy-settings"
            >
              إعدادات التحليلات
            </button>
          </nav>
        </div>
      </footer>
      <ConsentBanner />
    </div>
  )
}

export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 ${className}`}>{children}</div>
  )
}
