import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AuthCapabilities,
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type OAuthProviderId,
  type PublicUser,
} from '@pb/shared'
import { Download } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Container } from '../components/Layout'
import { Button, Card, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, errorMessage, fieldErrors } from '../lib/api'
import {
  ME_KEY,
  exchangeNeonSession,
  syncConsentToServer,
  useAuthActions,
  useAuthCapabilities,
  useMe,
} from '../lib/auth'
import { neonChangePassword, neonSignIn, neonSignOut } from '../lib/neon-auth'
import { CapabilitiesError, PROVIDER_LABELS, ProviderIcon, authErrorMessage } from './AuthPages'
import { getConsent, onConsentChange, setConsent } from '../lib/consent'
import { isFreeLaunch } from '../lib/launch'

interface Purchase {
  id: string
  status: string
  amountMinor: number
  currency: string
  createdAt: string
}

function Profile({ user }: { user: PublicUser }) {
  const { setUser } = useAuthActions()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [githubUrl, setGithubUrl] = useState(user.githubUrl ?? '')
  const save = useMutation({
    mutationFn: () =>
      api.patch<{ user: PublicUser }>('/api/me/profile', {
        displayName,
        githubUrl: githubUrl.trim() || null,
      }),
    onSuccess: ({ user: u }) => setUser(u),
  })
  const errors = fieldErrors(save.error)

  return (
    <Card>
      <h2 className="mb-6 text-xl font-bold">البيانات</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
        className="space-y-5"
      >
        <Field label="الإيميل" value={user.email} dir="ltr" disabled readOnly />
        <Field
          label="الاسم"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
        />
        <Field
          label="لينك الـ repo على GitHub (اختياري)"
          dir="ltr"
          placeholder="https://github.com/you/taskflow-lite"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          error={errors.githubUrl}
          hint="لو حابب تشاركنا مشروعك. مش بيظهر لحد تاني."
        />
        {save.isSuccess && (
          <p role="status" className="text-sm text-ok">
            اتحفظ.
          </p>
        )}
        {save.isError && !Object.keys(errors).length && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(save.error)}
          </p>
        )}
        <Button type="submit" loading={save.isPending}>
          احفظ
        </Button>
      </form>
    </Card>
  )
}

function PasswordSetupHint() {
  return (
    <p className="text-sm leading-7 text-muted">
      دخلت بـ Google أو GitHub ومعندكش كلمة مرور؟{' '}
      <Link to="/forgot-password" className="text-amber-2 hover:underline">
        اعمل كلمة مرور من لينك على إيميلك
      </Link>{' '}
      الأول.
    </p>
  )
}

function ChangePassword() {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const change = useMutation({
    mutationFn: () => api.post('/api/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrent('')
      setNew('')
    },
  })
  return (
    <Card>
      <h2 className="mb-6 text-xl font-bold">تغيير كلمة المرور</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          change.mutate()
        }}
        className="space-y-5"
      >
        <PasswordSetupHint />
        <Field
          label="كلمة المرور الحالية"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="كلمة المرور الجديدة"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          error={fieldErrors(change.error).newPassword}
        />
        {change.isSuccess && (
          <p role="status" className="text-sm text-ok">
            اتغيرت، وخرجناك من باقي الأجهزة.
          </p>
        )}
        {change.isError && !fieldErrors(change.error).newPassword && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(change.error)}
          </p>
        )}
        <Button type="submit" variant="ghost" loading={change.isPending}>
          غير كلمة المرور
        </Button>
      </form>
    </Card>
  )
}

const NEON_PASSWORD_MIN = 10

// Neon mode: the password lives in Neon Auth. Changing it revokes every other upstream session
// (and so every other local session); this device re-binds with a fresh proof.
function NeonChangePassword({ url }: { url: string }) {
  const qc = useQueryClient()
  const { setUser } = useAuthActions()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [clientError, setClientError] = useState<string>()
  const change = useMutation({
    mutationFn: async () => {
      const proof = await neonChangePassword(url, { currentPassword, newPassword })
      return exchangeNeonSession(proof, 'login')
    },
    onSuccess: ({ user }) => {
      setUser(user)
      setCurrent('')
      setNew('')
    },
    onError: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < NEON_PASSWORD_MIN) {
      setClientError(`كلمة المرور لازم تكون ${NEON_PASSWORD_MIN} حروف على الأقل`)
      return
    }
    setClientError(undefined)
    change.mutate()
  }

  return (
    <Card>
      <h2 className="mb-6 text-xl font-bold">تغيير كلمة المرور</h2>
      <form onSubmit={submit} className="space-y-5 ph-no-capture">
        <Field
          label="كلمة المرور الحالية"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="كلمة المرور الجديدة"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          error={clientError}
        />
        {change.isSuccess && (
          <p role="status" className="text-sm text-ok">
            اتغيرت، وخرجناك من باقي الأجهزة.
          </p>
        )}
        {change.isError && (
          <p role="alert" className="text-sm text-rose">
            {authErrorMessage(change.error)}
          </p>
        )}
        <Button type="submit" variant="ghost" loading={change.isPending}>
          غير كلمة المرور
        </Button>
      </form>
    </Card>
  )
}

function AnalyticsSettings() {
  const [consent, setLocal] = useState(() => getConsent() ?? { analytics: false, replay: false })
  const [saved, setSaved] = useState(false)
  useEffect(() => onConsentChange((c) => setLocal(c ?? { analytics: false, replay: false })), [])

  function update(next: { analytics: boolean; replay: boolean }) {
    setConsent(next)
    setSaved(true)
    void syncConsentToServer()
  }

  return (
    <Card>
      <h2 className="mb-4 text-xl font-bold">التحليلات</h2>
      <div className="space-y-4 text-sm leading-7">
        <label className="flex gap-3">
          <input
            type="checkbox"
            className="mt-1.5 size-4 accent-[var(--color-amber)]"
            checked={consent.analytics}
            onChange={(e) =>
              update({ analytics: e.target.checked, replay: e.target.checked && consent.replay })
            }
          />
          <span>
            تحليلات استخدام (PostHog) مربوطة بمعرّف داخلي لحسابك. مش بنبعت إيميل أو اسم أو بيانات
            دفع.
          </span>
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            className="mt-1.5 size-4 accent-[var(--color-amber)]"
            checked={consent.replay}
            disabled={!consent.analytics}
            onChange={(e) => update({ analytics: consent.analytics, replay: e.target.checked })}
          />
          <span>تسجيل الجلسات (session replay) مع إخفاء كل الحقول والكود.</span>
        </label>
        {saved && (
          <p role="status" className="text-ok">
            اتحفظ.
          </p>
        )}
      </div>
    </Card>
  )
}

function Purchases() {
  const { data } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.get<{ purchases: Purchase[] }>('/api/me/purchases').then((d) => d.purchases),
  })
  return (
    <Card>
      <h2 className="mb-4 text-xl font-bold">المشتريات</h2>
      {data && data.length === 0 && (
        <p className="text-sm text-muted">مفيش مشتريات. الدفع مش متاح لسه أصلًا.</p>
      )}
      <ul className="space-y-2 text-sm">
        {data?.map((p) => (
          <li key={p.id}>
            {p.status} · {p.amountMinor / 100} {p.currency}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function useDeleteAccount() {
  const navigate = useNavigate()
  const { setUser } = useAuthActions()
  return useMutation({
    mutationFn: (body: { confirm: string; password?: string }) => api.post('/api/me/delete', body),
    onSuccess: () => {
      setUser(null)
      navigate('/')
    },
  })
}

function PasswordDelete() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const del = useDeleteAccount()

  function submit(e: FormEvent) {
    e.preventDefault()
    del.mutate({ password, confirm })
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <PasswordSetupHint />
      <Field
        label="كلمة المرور"
        type="password"
        autoComplete="current-password"
        dir="ltr"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="اكتب DELETE للتأكيد"
        dir="ltr"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {del.isError && (
        <p role="alert" className="text-sm text-rose">
          {errorMessage(del.error)}
        </p>
      )}
      <Button
        type="submit"
        variant="danger"
        disabled={confirm !== 'DELETE' || !password}
        loading={del.isPending}
      >
        امسح الحساب نهائيًا
      </Button>
    </form>
  )
}

// Neon mode: a fresh sign-in with the account password produces the proof the API requires.
function NeonDelete({ url, email }: { url: string; email: string }) {
  const navigate = useNavigate()
  const { setUser } = useAuthActions()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const del = useMutation({
    mutationFn: async () => {
      const neonProof = await neonSignIn(url, { email, password })
      await api.post('/api/me/delete', { confirm, neonProof })
    },
    onSuccess: async () => {
      await neonSignOut(url)
      setUser(null)
      navigate('/')
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        del.mutate()
      }}
      className="mt-4 space-y-4 ph-no-capture"
    >
      <Field
        label="كلمة المرور"
        type="password"
        autoComplete="current-password"
        dir="ltr"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="اكتب DELETE للتأكيد"
        dir="ltr"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {del.isError && (
        <p role="alert" className="text-sm text-rose">
          {authErrorMessage(del.error)}
        </p>
      )}
      <Button
        type="submit"
        variant="danger"
        disabled={confirm !== 'DELETE' || !password}
        loading={del.isPending}
      >
        امسح الحساب نهائيًا
      </Button>
    </form>
  )
}

const REAUTH_ERROR_MESSAGES: Partial<Record<OAuthErrorCode, string>> = {
  cancelled: 'لغيت التأكيد. الحساب لسه موجود.',
  reauth_mismatch: 'الحساب اللي اخترته مش هو الحساب المربوط بيك. اختار نفس الحساب اللي سجلت بيه.',
  session_changed: 'الجلسة اتغيرت أثناء التأكيد. ادخل تاني وابدأ من الأول.',
  expired: 'التأكيد انتهى أو اتفتح في متصفح تاني. جرب تاني.',
  email_unverified: 'الإيميل في الحساب ده مش متأكد عند مقدم الخدمة.',
}
const REAUTH_FALLBACK_ERROR = 'مقدرناش نأكد هويتك. جرب تاني.'

function reauthErrorMessage(raw: string | null): string | null {
  const code = OAUTH_ERROR_CODES.find((c) => c === raw)
  if (!code) return null
  return REAUTH_ERROR_MESSAGES[code] ?? REAUTH_FALLBACK_ERROR
}

// Step 1: type DELETE. Step 2: re-confirm with the linked provider (full redirect).
// Step 3: back here with ?reauth=ok, press the explicit final delete within ~5 minutes.
function ReauthDelete({ providers }: { providers: OAuthProviderId[] }) {
  const [params, setParams] = useSearchParams()
  const returnedFromReauth = params.get('reauth') === 'ok'
  const reauthError = reauthErrorMessage(params.get('reauth_error'))
  const [confirm, setConfirm] = useState('')
  const del = useDeleteAccount()
  const start = useMutation({
    mutationFn: (provider: OAuthProviderId) =>
      api.post<{ url: string }>(`/api/auth/oauth/${provider}/start`, { intent: 'reauth' }),
    onSuccess: ({ url }) => window.location.assign(url),
  })

  function restart() {
    setParams({}, { replace: true })
    del.reset()
  }

  if (returnedFromReauth) {
    return (
      <div className="mt-4 space-y-4">
        <Notice>
          لو خلصت التأكيد بحسابك المربوط، اضغط على المسح النهائي من نفس الجهاز خلال حوالي 5 دقايق.
          لو التأكيد مش صالح أو انتهى، المسح مش هيتم وهتحتاج تأكد تاني.
        </Notice>
        {del.isError && (
          <p role="alert" className="text-sm text-rose">
            {errorMessage(del.error)}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="danger"
            loading={del.isPending}
            onClick={() => del.mutate({ confirm: 'DELETE' })}
          >
            امسح الحساب نهائيًا
          </Button>
          <Button type="button" variant="quiet" onClick={restart}>
            إلغاء
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {reauthError && (
        <div role="alert">
          <Notice tone="rose">{reauthError}</Notice>
        </div>
      )}
      <Field
        label="اكتب DELETE للتأكيد"
        dir="ltr"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <p className="text-sm leading-7 text-muted">
        بعد كده هنحولك لحسابك المربوط تأكد إنه إنت، وترجع هنا تضغط على المسح النهائي.
      </p>
      <div className="space-y-3">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="danger"
            className="w-full"
            disabled={confirm !== 'DELETE' || start.isPending || start.isSuccess}
            loading={start.isPending && start.variables === provider}
            onClick={() => start.mutate(provider)}
          >
            <ProviderIcon provider={provider} />
            <span>
              أكد هويتك بـ <bdi>{PROVIDER_LABELS[provider]}</bdi>
            </span>
          </Button>
        ))}
      </div>
      {start.isError && (
        <p role="alert" className="text-sm text-rose">
          {errorMessage(start.error)}
        </p>
      )}
    </div>
  )
}

function Privacy({ capabilities, email }: { capabilities: AuthCapabilities; email: string }) {
  const passwordAuth = capabilities.passwordAuth
  const linked = capabilities.linkedProviders ?? []
  const neonUrl = capabilities.mode === 'neon' ? capabilities.neonAuthUrl : null

  return (
    <Card className="border-rose/30">
      <h2 className="mb-4 text-xl font-bold">الخصوصية وبياناتك</h2>
      <p className="mb-4 text-sm leading-7 text-muted">
        تقدر تنزل نسخة من كل بياناتك عندنا بصيغة JSON.
      </p>
      <a
        href="/api/me/export"
        className="mb-8 inline-flex items-center gap-2 rounded-xl border border-line-2 px-4 py-2 text-sm hover:bg-white/5"
      >
        <Download className="size-4" aria-hidden /> نزل بياناتي
      </a>
      <h3 id="delete-account" className="mb-2 font-semibold text-rose">
        امسح حسابي
      </h3>
      <Notice tone="rose">
        هنمسح اسمك وإيميلك وتقدمك يبقى مش مربوط بيك، وهنخرجك من كل الأجهزة. الخطوة دي مش بترجع.
      </Notice>
      {neonUrl && <NeonDelete url={neonUrl} email={email} />}
      {!neonUrl && linked.length > 0 && <ReauthDelete providers={linked} />}
      {passwordAuth && linked.length > 0 && (
        <p className="mt-6 text-sm text-muted">أو امسح باستخدام كلمة المرور:</p>
      )}
      {passwordAuth && <PasswordDelete />}
      {!neonUrl && !passwordAuth && linked.length === 0 && (
        <p className="mt-4 text-sm leading-7 text-muted">
          حسابك مش مربوط بحساب Google أو GitHub متاح للتأكيد دلوقتي. تواصل معانا من صفحة{' '}
          <Link to="/contact" className="text-amber-2 hover:underline">
            التواصل
          </Link>{' '}
          عشان نساعدك تمسحه.
        </p>
      )}
    </Card>
  )
}

export function Account() {
  const { data: user } = useMe()
  const capabilities = useAuthCapabilities()
  if (!user) return null
  if (capabilities.isLoading) return <Loading />
  if (!capabilities.data) {
    return (
      <Container className="max-w-2xl">
        <PageHeader eyebrow="حسابي" title="الإعدادات" />
        <CapabilitiesError onRetry={() => capabilities.refetch()} />
      </Container>
    )
  }
  const passwordAuth = capabilities.data.passwordAuth
  const neonUrl = capabilities.data.mode === 'neon' ? capabilities.data.neonAuthUrl : null
  return (
    <Container className="max-w-2xl">
      <PageHeader eyebrow="حسابي" title="الإعدادات" />
      <div className="space-y-6">
        <Profile user={user} />
        {passwordAuth && <ChangePassword />}
        {neonUrl && <NeonChangePassword url={neonUrl} />}
        <AnalyticsSettings />
        {!isFreeLaunch() && <Purchases />}
        <Privacy capabilities={capabilities.data} email={user.email} />
      </div>
    </Container>
  )
}
