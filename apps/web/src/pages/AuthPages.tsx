import { useMutation } from '@tanstack/react-query'
import {
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type OAuthProviderId,
  type PublicUser,
} from '@pb/shared'
import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { safeNext } from '../components/Guards'
import { Container } from '../components/Layout'
import { Button, ButtonLink, Card, ErrorState, Field, Loading, Notice } from '../components/ui'
import { ApiRequestError, api, errorMessage, fieldErrors } from '../lib/api'
import { analytics, getUtm, trackClick } from '../lib/analytics'
import { exchangeNeonSession, useAuthActions, useAuthCapabilities, useMe } from '../lib/auth'
import { NeonAuthError, neonSignIn, neonSignOut, neonSignUp, readNeonProof } from '../lib/neon-auth'

const PASSWORD_MIN = 10
const PRIVACY_REQUIRED = 'لازم توافق على سياسة الخصوصية'

// Only the API/SDK error code is sent (e.g. UNAUTHORIZED, CONFLICT, RATE_LIMITED), never form input.
function failureReason(error: unknown): string {
  if (error instanceof NeonAuthError) return error.code
  return error instanceof ApiRequestError ? error.code : 'NETWORK'
}

export function authErrorMessage(error: unknown): string {
  return error instanceof NeonAuthError ? error.message : errorMessage(error)
}

function isApiCode(error: unknown, code: string) {
  return error instanceof ApiRequestError && error.code === code
}

const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  cancelled: 'لغيت الدخول. تقدر تجرب تاني في أي وقت.',
  failed: 'مقدرناش نكمل. جرب تاني، أو استخدم الإيميل وكلمة المرور.',
  expired: 'المحاولة انتهت أو اتفتحت في متصفح تاني. جرب تاني من هنا.',
  email_unverified: 'لازم يكون عندك إيميل أساسي متأكد (verified) في الحساب ده عشان تكمل.',
  use_existing_method:
    'الإيميل ده مربوط بحساب موجود. ادخل بالطريقة اللي استخدمتها أول مرة، أو استخدم "نسيت كلمة المرور".',
  signup_required: 'مفيش حساب لسه. وافق على سياسة الخصوصية تحت وكمّل التسجيل.',
  account_unavailable: 'الحساب ده مش متاح.',
  already_signed_in: 'إنت مسجل دخول بالفعل.',
  rate_limited: 'محاولات كتير. استنى شوية وجرب تاني.',
  reauth_mismatch: 'الحساب اللي اخترته مش هو الحساب المربوط بيك.',
  session_changed: 'الجلسة اتغيرت. ادخل تاني وجرب من الأول.',
}

const SOCIAL_ERROR_OVERRIDES: Partial<Record<OAuthErrorCode, string>> = {
  failed: 'مقدرناش نكمل. جرب تاني بعد شوية.',
  use_existing_method:
    'الإيميل ده مربوط بحساب موجود. ادخل بنفس الطريقة (Google أو GitHub) اللي استخدمتها أول مرة.',
}

export const PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  google: 'Google',
  github: 'GitHub',
}

function oauthErrorMessage(raw: string | null, socialOnly = false): string | null {
  const code = OAUTH_ERROR_CODES.find((c) => c === raw)
  if (!code) return null
  return (socialOnly ? SOCIAL_ERROR_OVERRIDES[code] : undefined) ?? OAUTH_ERROR_MESSAGES[code]
}

export function ProviderIcon({ provider }: { provider: OAuthProviderId }) {
  if (provider === 'github') {
    return (
      <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  )
}

function OAuthButtons({
  intent,
  next,
  providers,
  divider = true,
  acceptPrivacy = false,
  onPrivacyRequired,
}: {
  intent: 'login' | 'signup'
  next: string
  providers: OAuthProviderId[]
  divider?: boolean
  acceptPrivacy?: boolean
  onPrivacyRequired?: () => void
}) {
  const start = useMutation({
    mutationFn: (provider: OAuthProviderId) =>
      api.post<{ url: string }>(`/api/auth/oauth/${provider}/start`, {
        intent,
        next,
        ...(intent === 'signup' ? { acceptPrivacy } : {}),
      }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) =>
      analytics.capture(intent === 'signup' ? 'signup_failed' : 'login_failed', {
        reason: failureReason(error),
      }),
  })

  if (providers.length === 0) return null

  function begin(provider: OAuthProviderId) {
    if (intent === 'signup' && !acceptPrivacy) {
      onPrivacyRequired?.()
      return
    }
    start.mutate(provider)
  }

  return (
    <div className={divider ? 'mt-6' : ''}>
      {divider && (
        <div className="mb-4 flex items-center gap-3 text-xs text-dim" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          أو
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className="space-y-3">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant={divider ? 'ghost' : 'primary'}
            className="w-full"
            loading={start.isPending && start.variables === provider}
            disabled={start.isPending || start.isSuccess}
            onClick={() => begin(provider)}
          >
            <ProviderIcon provider={provider} />
            <span>
              كمّل بـ <bdi>{PROVIDER_LABELS[provider]}</bdi>
            </span>
          </Button>
        ))}
      </div>
      {start.isError && (
        <p role="alert" className="mt-3 text-sm text-rose">
          {errorMessage(start.error)}
        </p>
      )}
    </div>
  )
}

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

function OAuthErrorNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-5">
      <Notice tone="rose">{message}</Notice>
    </div>
  )
}

function NoProvidersNotice() {
  return <Notice tone="amber">الدخول مش متاح دلوقتي. جرب تاني بعد شوية.</Notice>
}

function PrivacyConsent({
  checked,
  onChange,
  error,
  socialOnly,
  neon = false,
}: {
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  socialOnly: boolean
  neon?: boolean
}) {
  return (
    <div>
      <label className="flex gap-3 text-sm leading-7">
        <input
          type="checkbox"
          className="mt-1.5 size-4 accent-[var(--color-amber)]"
          checked={checked}
          onChange={onChange}
          aria-invalid={Boolean(error)}
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
          .{' '}
          {neon
            ? 'حسابك وكلمة المرور بيتداروا عند Neon Auth، وإحنا بنخزن الإيميل والاسم ومعرّف حسابك هناك وتقدمك في الدروس بس.'
            : socialOnly
              ? 'بنخزن الإيميل والاسم ومعرّف حسابك في Google أو GitHub وتقدمك في الدروس بس.'
              : 'بنخزن الإيميل والاسم وتقدمك في الدروس بس (ولو سجلت بـ Google أو GitHub، معرّف حسابك هناك).'}
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}
    </div>
  )
}

export function CapabilitiesError({ onRetry }: { onRetry: () => void }) {
  return <ErrorState message="مش قادرين نعرف طرق الدخول المتاحة دلوقتي." onRetry={onRetry} />
}

function onboardingPath(next: string) {
  return `/onboarding?next=${encodeURIComponent(next)}`
}

// Neon mode: the SDK signs in against Neon Auth, then the API verifies the session and binds a
// local session to it. A first sign-in without a local account asks for privacy consent first.
function NeonLogin({ url, next }: { url: string; next: string }) {
  const { signedIn } = useAuthActions()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsConsent, setNeedsConsent] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [consentError, setConsentError] = useState<string>()

  const login = useMutation({
    mutationFn: async () => {
      const proof = needsConsent
        ? await readNeonProof(url)
        : await neonSignIn(url, { email, password })
      return exchangeNeonSession(proof, needsConsent ? 'signup' : 'login', needsConsent)
    },
    onSuccess: ({ user, created }) => {
      navigate(created ? onboardingPath(next) : next, { replace: true })
      signedIn(user, created ? 'signup' : 'login', 'login_page')
    },
    onError: (error) => {
      analytics.capture('login_failed', { reason: failureReason(error) })
      if (isApiCode(error, 'SIGNUP_REQUIRED')) {
        setNeedsConsent(true)
        return
      }
      if (error instanceof ApiRequestError) void neonSignOut(url)
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    trackClick('login-submit')
    if (needsConsent && !acceptPrivacy) {
      setConsentError(PRIVACY_REQUIRED)
      return
    }
    setConsentError(undefined)
    login.mutate()
  }

  const showError = login.isError && !isApiCode(login.error, 'SIGNUP_REQUIRED')

  return (
    <AuthShell title="أهلًا تاني" subtitle="كمّل من المكان اللي وقفت فيه.">
      <form onSubmit={submit} className="space-y-5 ph-no-capture" noValidate>
        {needsConsent ? (
          <>
            <Notice tone="amber">
              دخلت بنجاح، بس لسه مفيش حساب عندنا. وافق على سياسة الخصوصية عشان نكمل حسابك.
            </Notice>
            <PrivacyConsent
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              error={consentError}
              socialOnly
              neon
            />
          </>
        ) : (
          <>
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
          </>
        )}
        {showError && (
          <p role="alert" className="text-sm text-rose">
            {authErrorMessage(login.error)}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={login.isPending}
          analyticsId="login-submit"
        >
          {needsConsent ? 'كمّل الحساب' : 'دخول'}
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

function NeonSignup({ url, next }: { url: string; next: string | null }) {
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
    mutationFn: async () => {
      const proof = await neonSignUp(url, {
        email: form.email.trim(),
        password: form.password,
        name: form.displayName.trim(),
      })
      return exchangeNeonSession(proof, 'signup', true)
    },
    onSuccess: ({ user, created }) => {
      navigate(created ? onboardingPath(safeNext(next)) : safeNext(next), { replace: true })
      signedIn(user, created ? 'signup' : 'login', next ? 'signup_with_next' : 'signup_page')
    },
    onError: (error) => {
      analytics.capture('signup_failed', { reason: failureReason(error) })
      if (error instanceof ApiRequestError) void neonSignOut(url)
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    trackClick('signup-submit')
    const found: Record<string, string> = {}
    if (form.displayName.trim().length < 2) found.displayName = 'اكتب اسمك (حرفين على الأقل)'
    if (!form.email.includes('@')) found.email = 'الإيميل مش صحيح'
    if (form.password.length < PASSWORD_MIN)
      found.password = `كلمة المرور لازم تكون ${PASSWORD_MIN} حروف على الأقل`
    if (!form.acceptPrivacy) found.acceptPrivacy = PRIVACY_REQUIRED
    setClientErrors(found)
    if (Object.keys(found).length === 0) signup.mutate()
    else analytics.capture('signup_failed', { reason: 'client_validation' })
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
          error={clientErrors.displayName}
        />
        <Field
          label="الإيميل"
          type="email"
          autoComplete="email"
          dir="ltr"
          value={form.email}
          onChange={update('email')}
          error={clientErrors.email}
        />
        <Field
          label="كلمة المرور"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={form.password}
          onChange={update('password')}
          error={clientErrors.password}
          hint={`${PASSWORD_MIN} حروف على الأقل. جملة طويلة أحسن من كلمة معقدة.`}
        />
        <PrivacyConsent
          checked={form.acceptPrivacy}
          onChange={update('acceptPrivacy')}
          error={clientErrors.acceptPrivacy}
          socialOnly={false}
          neon
        />
        {signup.isError && (
          <p role="alert" className="text-sm text-rose">
            {authErrorMessage(signup.error)}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={signup.isPending}
          analyticsId="signup-submit"
        >
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

function NeonUnavailable({ title }: { title: string }) {
  return (
    <AuthShell title={title}>
      <NoProvidersNotice />
    </AuthShell>
  )
}

export function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { data: me } = useMe()
  const capabilities = useAuthCapabilities()
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
    onError: (error) => analytics.capture('login_failed', { reason: failureReason(error) }),
  })

  if (me) return <Navigate to={next} replace />

  const socialOnly = capabilities.data?.passwordAuth === false
  const providers = capabilities.data?.providers ?? []
  const oauthError = oauthErrorMessage(params.get('oauth_error'), socialOnly)
  const signupLink = (
    <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-amber-2">
      حساب جديد
    </Link>
  )

  if (capabilities.isLoading) {
    return (
      <AuthShell title="أهلًا تاني" subtitle="كمّل من المكان اللي وقفت فيه.">
        <Loading />
      </AuthShell>
    )
  }

  if (!capabilities.data) {
    return (
      <AuthShell title="أهلًا تاني">
        <CapabilitiesError onRetry={() => capabilities.refetch()} />
      </AuthShell>
    )
  }

  if (capabilities.data.mode === 'neon') {
    const url = capabilities.data.neonAuthUrl
    return url ? <NeonLogin url={url} next={next} /> : <NeonUnavailable title="أهلًا تاني" />
  }

  if (socialOnly) {
    return (
      <AuthShell title="أهلًا تاني" subtitle="ادخل بحساب Google أو GitHub اللي سجلت بيه.">
        <OAuthErrorNotice message={oauthError} />
        {providers.length === 0 ? (
          <NoProvidersNotice />
        ) : (
          <OAuthButtons intent="login" next={next} providers={providers} divider={false} />
        )}
        <div className="mt-6 text-sm">{signupLink}</div>
      </AuthShell>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    trackClick('login-submit')
    login.mutate()
  }

  return (
    <AuthShell title="أهلًا تاني" subtitle="كمّل من المكان اللي وقفت فيه.">
      <OAuthErrorNotice message={oauthError} />
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
        <Button
          type="submit"
          className="w-full"
          loading={login.isPending}
          analyticsId="login-submit"
        >
          دخول
        </Button>
      </form>
      <OAuthButtons intent="login" next={next} providers={providers} />
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        <Link to="/forgot-password" className="text-muted hover:text-paper">
          نسيت كلمة المرور؟
        </Link>
        {signupLink}
      </div>
    </AuthShell>
  )
}

export function Signup() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const { data: me } = useMe()
  const capabilities = useAuthCapabilities()
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
    onError: (error) => analytics.capture('signup_failed', { reason: failureReason(error) }),
  })

  if (me && !signup.isSuccess) return <Navigate to={safeNext(next)} replace />

  const socialOnly = capabilities.data?.passwordAuth === false
  const providers = capabilities.data?.providers ?? []
  const oauthError = oauthErrorMessage(params.get('oauth_error'), socialOnly)
  const serverErrors = fieldErrors(signup.error)
  const errors = { ...serverErrors, ...clientErrors }

  function submit(e: FormEvent) {
    e.preventDefault()
    trackClick('signup-submit')
    const found: Record<string, string> = {}
    if (form.displayName.trim().length < 2) found.displayName = 'اكتب اسمك (حرفين على الأقل)'
    if (!form.email.includes('@')) found.email = 'الإيميل مش صحيح'
    if (form.password.length < PASSWORD_MIN)
      found.password = `كلمة المرور لازم تكون ${PASSWORD_MIN} حروف على الأقل`
    if (!form.acceptPrivacy) found.acceptPrivacy = PRIVACY_REQUIRED
    setClientErrors(found)
    if (Object.keys(found).length === 0) signup.mutate()
    else analytics.capture('signup_failed', { reason: 'client_validation' })
  }

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  const oauthButtons = (
    <OAuthButtons
      intent="signup"
      next={safeNext(next)}
      providers={providers}
      divider={!socialOnly}
      acceptPrivacy={form.acceptPrivacy}
      onPrivacyRequired={() => {
        setClientErrors({ acceptPrivacy: PRIVACY_REQUIRED })
        analytics.capture('signup_failed', { reason: 'client_validation' })
      }}
    />
  )
  const loginLink = (
    <p className="mt-6 text-sm text-muted">
      عندك حساب؟{' '}
      <Link to="/login" className="text-amber-2">
        ادخل
      </Link>
    </p>
  )

  if (capabilities.isLoading) {
    return (
      <AuthShell title="ابدأ مجانًا" subtitle="من غير كارت. هنحفظ تقدمك ونفتحلك المشروع كامل.">
        <Loading />
      </AuthShell>
    )
  }

  if (!capabilities.data) {
    return (
      <AuthShell title="ابدأ مجانًا">
        <CapabilitiesError onRetry={() => capabilities.refetch()} />
      </AuthShell>
    )
  }

  if (capabilities.data.mode === 'neon') {
    const url = capabilities.data.neonAuthUrl
    return url ? <NeonSignup url={url} next={next} /> : <NeonUnavailable title="ابدأ مجانًا" />
  }

  if (socialOnly) {
    return (
      <AuthShell
        title="ابدأ مجانًا"
        subtitle="سجل بحساب Google أو GitHub. من غير كارت ومن غير كلمة مرور."
      >
        <OAuthErrorNotice message={oauthError} />
        {providers.length === 0 ? (
          <NoProvidersNotice />
        ) : (
          <div className="space-y-5 ph-no-capture">
            <PrivacyConsent
              checked={form.acceptPrivacy}
              onChange={update('acceptPrivacy')}
              error={errors.acceptPrivacy}
              socialOnly
            />
            {oauthButtons}
          </div>
        )}
        {loginLink}
      </AuthShell>
    )
  }

  return (
    <AuthShell title="ابدأ مجانًا" subtitle="من غير كارت. هنحفظ تقدمك ونفتحلك المشروع كامل.">
      <OAuthErrorNotice message={oauthError} />
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
        <PrivacyConsent
          checked={form.acceptPrivacy}
          onChange={update('acceptPrivacy')}
          error={errors.acceptPrivacy}
          socialOnly={false}
        />
        {signup.isError && Object.keys(serverErrors).length === 0 && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(signup.error)}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={signup.isPending}
          analyticsId="signup-submit"
        >
          اعمل حساب
        </Button>
      </form>
      {oauthButtons}
      {loginLink}
    </AuthShell>
  )
}

function SocialOnlyFallback({ title, neon = false }: { title: string; neon?: boolean }) {
  return (
    <AuthShell title={title}>
      {neon ? (
        <p className="mb-6 text-sm leading-7 text-muted">
          استرجاع كلمة المرور من الموقع مش متاح لسه في النسخة التجريبية. لو نسيت كلمة المرور، تواصل
          معانا من صفحة{' '}
          <Link to="/contact" className="text-amber-2 hover:underline">
            التواصل
          </Link>{' '}
          وهنساعدك.
        </p>
      ) : (
        <p className="mb-6 text-sm leading-7 text-muted">
          Portfolab بيستخدم الدخول بـ Google أو GitHub بس، ومفيش كلمات مرور عندنا تتنسي أو تتغير.
          ادخل بنفس الحساب اللي سجلت بيه. لو مش قادر تدخل على حساب Google أو GitHub نفسه، استرجعه من
          خلالهم الأول.
        </p>
      )}
      <ButtonLink to="/login" className="w-full">
        روح لصفحة الدخول
      </ButtonLink>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const capabilities = useAuthCapabilities()
  const [email, setEmail] = useState('')
  const request = useMutation({
    mutationFn: () => api.post<{ message: string }>('/api/auth/forgot-password', { email }),
  })

  if (capabilities.isLoading) return <Loading />
  if (!capabilities.data) {
    return (
      <AuthShell title="نسيت كلمة المرور">
        <CapabilitiesError onRetry={() => capabilities.refetch()} />
      </AuthShell>
    )
  }
  if (capabilities.data.passwordAuth === false) {
    return <SocialOnlyFallback title="نسيت كلمة المرور" neon={capabilities.data.mode === 'neon'} />
  }

  return (
    <AuthShell title="نسيت كلمة المرور" subtitle="اكتب إيميلك وهنبعتلك لينك لو الحساب موجود.">
      {request.isSuccess ? (
        <Notice tone="teal">{request.data.message}</Notice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            trackClick('forgot-password-submit')
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
  const capabilities = useAuthCapabilities()
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: () => api.post('/api/auth/reset-password', { token, password }),
  })

  if (capabilities.isLoading) return <Loading />
  if (!capabilities.data) {
    return (
      <AuthShell title="إعادة تعيين كلمة المرور">
        <CapabilitiesError onRetry={() => capabilities.refetch()} />
      </AuthShell>
    )
  }
  if (capabilities.data.passwordAuth === false) {
    return (
      <SocialOnlyFallback
        title="إعادة تعيين كلمة المرور"
        neon={capabilities.data.mode === 'neon'}
      />
    )
  }

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
            trackClick('reset-password-submit')
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
