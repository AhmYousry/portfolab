import { useMutation } from '@tanstack/react-query'
import type { PublicUser } from '@pb/shared'
import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { safeNext } from '../components/Guards'
import { Container } from '../components/Layout'
import { Button, Card, Field, Notice } from '../components/ui'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { getUtm } from '../lib/analytics'
import { useAuthActions, useMe } from '../lib/auth'

const PASSWORD_MIN = 10

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Container className="max-w-md">
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>
      {subtitle && <p className="mb-8 text-muted">{subtitle}</p>}
      <Card>{children}</Card>
    </Container>
  )
}

export function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { data: me } = useMe()
  const { signedIn } = useAuthActions()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: () => api.post<{ user: PublicUser }>('/api/auth/login', { email, password }),
    onSuccess: ({ user }) => {
      signedIn(user, 'login', 'login_page')
      navigate(next, { replace: true })
    },
  })

  if (me) return <Navigate to={next} replace />

  function submit(e: FormEvent) {
    e.preventDefault()
    login.mutate()
  }

  return (
    <AuthShell title="أهلًا تاني" subtitle="كمّل من المكان اللي وقفت فيه.">
      <form onSubmit={submit} className="space-y-5 ph-no-capture" noValidate>
        <Field
          label="الإيميل"
          type="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="كلمة المرور"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {login.isError && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(login.error)}
          </p>
        )}
        <Button type="submit" className="w-full" loading={login.isPending}>
          دخول
        </Button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        <Link to="/forgot-password" className="text-muted hover:text-paper">
          نسيت كلمة المرور؟
        </Link>
        <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-amber-2">
          حساب جديد
        </Link>
      </div>
    </AuthShell>
  )
}

export function Signup() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const { data: me } = useMe()
  const { signedIn } = useAuthActions()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    acceptPrivacy: false,
  })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  const signup = useMutation({
    mutationFn: () =>
      api.post<{ user: PublicUser }>('/api/auth/signup', { ...form, utm: getUtm() }),
    onSuccess: ({ user }) => {
      signedIn(user, 'signup', next ? 'signup_with_next' : 'signup_page')
      navigate(`/onboarding?next=${encodeURIComponent(safeNext(next))}`, { replace: true })
    },
  })

  if (me && !signup.isSuccess) return <Navigate to={safeNext(next)} replace />

  const serverErrors = fieldErrors(signup.error)
  const errors = { ...serverErrors, ...clientErrors }

  function submit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (form.displayName.trim().length < 2) found.displayName = 'اكتب اسمك (حرفين على الأقل)'
    if (!form.email.includes('@')) found.email = 'الإيميل مش صحيح'
    if (form.password.length < PASSWORD_MIN)
      found.password = `كلمة المرور لازم تكون ${PASSWORD_MIN} حروف على الأقل`
    if (!form.acceptPrivacy) found.acceptPrivacy = 'لازم توافق على سياسة الخصوصية'
    setClientErrors(found)
    if (Object.keys(found).length === 0) signup.mutate()
  }

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  return (
    <AuthShell title="ابدأ مجانًا" subtitle="من غير كارت. هنحفظ تقدمك ونفتحلك المشروع كامل.">
      <form onSubmit={submit} className="space-y-5 ph-no-capture" noValidate>
        <Field
          label="اسمك"
          autoComplete="name"
          value={form.displayName}
          onChange={update('displayName')}
          error={errors.displayName}
        />
        <Field
          label="الإيميل"
          type="email"
          autoComplete="email"
          dir="ltr"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Field
          label="كلمة المرور"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          hint={`${PASSWORD_MIN} حروف على الأقل. جملة طويلة أحسن من كلمة معقدة.`}
        />
        <div>
          <label className="flex gap-3 text-sm leading-7">
            <input
              type="checkbox"
              className="mt-1.5 size-4 accent-[var(--color-amber)]"
              checked={form.acceptPrivacy}
              onChange={update('acceptPrivacy')}
              aria-invalid={Boolean(errors.acceptPrivacy)}
            />
            <span>
              قريت ووافقت على{' '}
              <Link to="/privacy" className="text-amber-2 underline">
                سياسة الخصوصية
              </Link>{' '}
              و
              <Link to="/terms" className="text-amber-2 underline">
                الشروط
              </Link>
              . بنخزن الإيميل والاسم وتقدمك في الدروس بس.
            </span>
          </label>
          {errors.acceptPrivacy && <p className="mt-2 text-sm text-rose">{errors.acceptPrivacy}</p>}
        </div>
        {signup.isError && Object.keys(serverErrors).length === 0 && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(signup.error)}
          </p>
        )}
        <Button type="submit" className="w-full" loading={signup.isPending}>
          اعمل حساب
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        عندك حساب؟{' '}
        <Link to="/login" className="text-amber-2">
          ادخل
        </Link>
      </p>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const request = useMutation({
    mutationFn: () => api.post<{ message: string }>('/api/auth/forgot-password', { email }),
  })

  return (
    <AuthShell title="نسيت كلمة المرور" subtitle="اكتب إيميلك وهنبعتلك لينك لو الحساب موجود.">
      {request.isSuccess ? (
        <Notice tone="teal">{request.data.message}</Notice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            request.mutate()
          }}
          className="space-y-5 ph-no-capture"
          noValidate
        >
          <Field
            label="الإيميل"
            type="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {request.isError && (
            <p role="alert" className="text-sm text-rose">
              {errorMessage(request.error)}
            </p>
          )}
          <Button type="submit" className="w-full" loading={request.isPending}>
            ابعت اللينك
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: () => api.post('/api/auth/reset-password', { token, password }),
  })

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="اللينك مش صحيح">
        <p className="mb-4 text-muted">اللينك ناقص أو اتنسخ غلط.</p>
        <Link to="/forgot-password" className="text-amber-2">
          اطلب لينك جديد
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="كلمة مرور جديدة">
      {reset.isSuccess ? (
        <>
          <Notice tone="teal">اتغيرت. خرجناك من كل الأجهزة عشان الأمان.</Notice>
          <Link to="/login" className="mt-6 inline-block text-amber-2">
            ادخل بكلمة المرور الجديدة
          </Link>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            reset.mutate()
          }}
          className="space-y-5 ph-no-capture"
          noValidate
        >
          <Field
            label="كلمة المرور الجديدة"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors(reset.error).password}
            hint={`${PASSWORD_MIN} حروف على الأقل.`}
          />
          {reset.isError && !fieldErrors(reset.error).password && (
            <p role="alert" className="text-sm text-rose">
              {errorMessage(reset.error)}
            </p>
          )}
          <Button type="submit" className="w-full" loading={reset.isPending}>
            احفظ
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
