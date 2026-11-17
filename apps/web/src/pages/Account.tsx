import { useMutation, useQuery } from '@tanstack/react-query'
import type { PublicUser } from '@pb/shared'
import { Download } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Container } from '../components/Layout'
import { Button, Card, Field, Notice, PageHeader } from '../components/ui'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { syncConsentToServer, useAuthActions, useMe } from '../lib/auth'
import { getConsent, onConsentChange, setConsent } from '../lib/consent'

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

function Privacy() {
  const navigate = useNavigate()
  const { setUser } = useAuthActions()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const del = useMutation({
    mutationFn: () => api.post('/api/me/delete', { password, confirm }),
    onSuccess: () => {
      setUser(null)
      navigate('/')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    del.mutate()
  }

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
      <h3 className="mb-2 font-semibold text-rose">امسح حسابي</h3>
      <Notice tone="rose">
        هنمسح اسمك وإيميلك وتقدمك يبقى مش مربوط بيك، وهنخرجك من كل الأجهزة. الخطوة دي مش بترجع.
      </Notice>
      <form onSubmit={submit} className="mt-4 space-y-4">
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
    </Card>
  )
}

export function Account() {
  const { data: user } = useMe()
  if (!user) return null
  return (
    <Container className="max-w-2xl">
      <PageHeader eyebrow="حسابي" title="الإعدادات" />
      <div className="space-y-6">
        <Profile user={user} />
        <ChangePassword />
        <AnalyticsSettings />
        <Purchases />
        <Privacy />
      </div>
    </Container>
  )
}
