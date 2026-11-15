import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { captureUtm } from '../lib/analytics'
import { useAuthActions, useMe } from '../lib/auth'
import { ConsentBanner } from './ConsentBanner'

const PUBLIC_LINKS = [
  { to: '/curriculum', label: 'المنهج' },
  { to: '/pricing', label: 'الأسعار' },
]

const STUDENT_LINKS = [
  { to: '/dashboard', label: 'لوحتي' },
  { to: '/progress', label: 'التقدم' },
  { to: '/resources', label: 'الملفات' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'text-paper bg-white/5' : 'text-muted hover:text-paper'}`
}

export function Layout() {
  const { data: user } = useMe()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    captureUtm(location.search)
    setOpen(false)
  }, [location.pathname, location.search])

  const links = [...PUBLIC_LINKS, ...(user ? STUDENT_LINKS : [])]

  async function handleLogout() {
    await logout()
    navigate('/')
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
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span
              className="grid size-8 place-items-center rounded-lg bg-amber text-ink"
              aria-hidden
            >
              A
            </span>
            <span>
              Ahmed <span className="text-amber">&</span> Claude
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass}>
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NavLink to="/account" className={navClass}>
                  {user.displayName}
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-muted hover:text-paper"
                  aria-label="تسجيل الخروج"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  دخول
                </NavLink>
                <Link
                  to="/signup"
                  className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber-2"
                >
                  ابدأ مجانًا
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'اقفل القائمة' : 'افتح القائمة'}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </nav>
        {open && (
          <div id="mobile-nav" className="border-t border-line px-4 pb-4 md:hidden">
            <div className="flex flex-col gap-1 pt-3">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={navClass}>
                  {l.label}
                </NavLink>
              ))}
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
              {user ? (
                <>
                  <NavLink to="/account" className={navClass}>
                    حسابي
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg px-3 py-2 text-start text-sm text-muted"
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass}>
                    دخول
                  </NavLink>
                  <NavLink to="/signup" className={navClass}>
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
          <p>Ahmed & Claude — Portfolio Builder. محتوى تعليمي أصلي، ومفيش أي ضمان توظيف.</p>
          <nav className="flex flex-wrap gap-4" aria-label="روابط قانونية">
            <Link to="/privacy" className="hover:text-paper">
              الخصوصية
            </Link>
            <Link to="/terms" className="hover:text-paper">
              الشروط
            </Link>
            <Link to="/refund-policy" className="hover:text-paper">
              الاسترجاع
            </Link>
            <Link to="/contact" className="hover:text-paper">
              تواصل
            </Link>
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
