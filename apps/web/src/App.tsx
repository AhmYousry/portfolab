import { type ComponentType, Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from './components/Guards'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { FREE_LAUNCH_BLOCKED_PATHS, FREE_PROJECT_PATH, isFreeLaunch } from './lib/launch'
import { Account } from './pages/Account'
import { ForgotPassword, Login, ResetPassword, Signup } from './pages/AuthPages'
import { Curriculum } from './pages/Curriculum'
import { Landing } from './pages/Landing'
import { ContactPage, NotFound, PrivacyPage, RefundPage, TermsPage } from './pages/Legal'
import { Onboarding } from './pages/Onboarding'
import { Pricing } from './pages/Pricing'
import { ProjectPage } from './pages/ProjectPage'
import { Dashboard, Progress, Resources } from './pages/StudentPages'

function lazyNamed<M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M) {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
}

const adminPages = () => import('./pages/AdminPages')
const LessonPage = lazyNamed(() => import('./pages/LessonPage'), 'LessonPage')
const Checkout = lazyNamed(() => import('./pages/Checkout'), 'Checkout')
const CheckoutStatus = lazyNamed(() => import('./pages/Checkout'), 'CheckoutStatus')
const AdminLayout = lazyNamed(adminPages, 'AdminLayout')
const AdminOverview = lazyNamed(adminPages, 'AdminOverview')
const AdminProjects = lazyNamed(adminPages, 'AdminProjects')
const AdminLessonPreview = lazyNamed(adminPages, 'AdminLessonPreview')
const AdminUsers = lazyNamed(adminPages, 'AdminUsers')
const AdminOrders = lazyNamed(adminPages, 'AdminOrders')
const AdminAnalytics = lazyNamed(adminPages, 'AdminAnalytics')

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function commerceRoutes() {
  if (isFreeLaunch()) {
    return FREE_LAUNCH_BLOCKED_PATHS.map((path) => (
      <Route
        key={path}
        path={path.slice(1)}
        element={<Navigate to={FREE_PROJECT_PATH} replace />}
      />
    ))
  }
  return (
    <>
      <Route path="pricing" element={<Pricing />} />
      <Route path="refund-policy" element={<RefundPage />} />
      <Route
        path="checkout"
        element={
          <RequireAuth>
            <Checkout />
          </RequireAuth>
        }
      />
      <Route
        path="checkout/status"
        element={
          <RequireAuth>
            <CheckoutStatus />
          </RequireAuth>
        }
      />
    </>
  )
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            {commerceRoutes()}
            <Route path="curriculum" element={<Curriculum />} />
            <Route path="projects/:slug" element={<ProjectPage />} />
            <Route path="projects/:slug/lessons/:lessonSlug" element={<LessonPage />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="contact" element={<ContactPage />} />

            <Route
              path="onboarding"
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />
            <Route
              path="dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="progress"
              element={
                <RequireAuth>
                  <Progress />
                </RequireAuth>
              }
            />
            <Route
              path="resources"
              element={
                <RequireAuth>
                  <Resources />
                </RequireAuth>
              }
            />
            <Route
              path="account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAuth admin>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="lessons/:id" element={<AdminLessonPreview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
