import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ContentStatus, LessonView } from '@pb/shared'
import { Download, Eye, RefreshCw } from 'lucide-react'
import { NavLink, Outlet, useParams } from 'react-router'
import { Container } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { Badge, Button, Card, ErrorState, Loading, Notice } from '../components/ui'
import { api, errorMessage } from '../lib/api'

const STATUSES: ContentStatus[] = ['DRAFT', 'COMING_SOON', 'PUBLISHED']
const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  COMING_SOON: 'Coming soon',
  PUBLISHED: 'Published',
}

interface AdminLesson {
  id: string
  slug: string
  title: string
  status: ContentStatus
  isPreview: boolean
  order: number
}
interface AdminModule {
  id: string
  title: string
  order: number
  status: ContentStatus
  lessons: AdminLesson[]
}
interface AdminProject {
  id: string
  slug: string
  title: string
  tier: string
  status: ContentStatus
  modules: AdminModule[]
}

const TABS = [
  { to: '/admin', label: 'نظرة عامة', end: true },
  { to: '/admin/projects', label: 'المحتوى' },
  { to: '/admin/users', label: 'المستخدمين' },
  { to: '/admin/orders', label: 'الطلبات' },
  { to: '/admin/analytics', label: 'التحليلات' },
]

export function AdminLayout() {
  return (
    <Container>
      <h1 className="mb-6 text-3xl font-bold">Admin</h1>
      <nav
        className="mb-8 flex flex-wrap gap-2 border-b border-line pb-4"
        aria-label="أقسام الأدمن"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white/10 text-paper' : 'text-muted hover:text-paper'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </Container>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value.toLocaleString('ar-EG')}</p>
    </Card>
  )
}

export function AdminOverview() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () =>
      api.get<{
        totals: Record<string, number>
        funnel: { event: string; count: number }[]
        checkoutEnabled: boolean
      }>('/api/admin/overview'),
  })
  if (isLoading) return <Loading />
  if (isError || !data)
    return <ErrorState message="مش قادرين نحمل البيانات." onRetry={() => refetch()} />
  const t = data.totals
  return (
    <div className="space-y-8">
      <Notice>
        الأرقام دي من الداتابيز الحالية بس. التعليقات على Instagram مش leads مؤكدة، والدفع:{' '}
        {data.checkoutEnabled ? 'مفعل' : 'متوقف'}.
      </Notice>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="مستخدمين" value={t.users ?? 0} />
        <Stat label="تسجيلات في مشاريع" value={t.enrollments ?? 0} />
        <Stat label="دروس خلصت" value={t.lessonsCompleted ?? 0} />
        <Stat label="Checkpoints خلصت" value={t.checkpointsCompleted ?? 0} />
        <Stat label="مشتريات مدفوعة" value={t.paidPurchases ?? 0} />
      </div>
      <FunnelTable funnel={data.funnel} />
    </div>
  )
}

function FunnelTable({ funnel }: { funnel: { event: string; count: number }[] }) {
  const max = Math.max(1, ...funnel.map((f) => f.count))
  return (
    <Card>
      <h2 className="mb-4 text-xl font-bold">Funnel</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted">
            <th className="py-2 text-start font-medium">Event</th>
            <th className="py-2 text-start font-medium">العدد</th>
          </tr>
        </thead>
        <tbody>
          {funnel.map((f) => (
            <tr key={f.event} className="border-t border-line">
              <td className="py-2 font-mono" dir="ltr" style={{ textAlign: 'right' }}>
                {f.event}
              </td>
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <span className="w-10">{f.count}</span>
                  <span
                    className="h-1.5 rounded-full bg-teal/70"
                    style={{ width: `${(f.count / max) * 60}%` }}
                    aria-hidden
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function StatusControl({ kind, id, status }: { kind: string; id: string; status: ContentStatus }) {
  const qc = useQueryClient()
  const change = useMutation({
    mutationFn: (next: ContentStatus) =>
      api.patch(`/api/admin/${kind}/${id}/status`, { status: next, confirm: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'projects'] }),
  })
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label="الحالة"
        className="rounded-lg border border-line-2 bg-ink px-2 py-1 text-xs"
        value={status}
        disabled={change.isPending}
        onChange={(e) => {
          const next = e.target.value as ContentStatus
          if (
            window.confirm(
              `تغيير الحالة لـ ${STATUS_LABEL[next]}؟ التغيير هيتسجل في الـ audit log.`,
            )
          )
            change.mutate(next)
          else e.target.value = status
        }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {change.isError && (
        <span role="alert" className="text-xs text-rose">
          {errorMessage(change.error)}
        </span>
      )}
    </span>
  )
}

export function AdminProjects() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () =>
      api.get<{ projects: AdminProject[] }>('/api/admin/projects').then((d) => d.projects),
  })
  const importContent = useMutation({
    mutationFn: () => api.post<{ report: Record<string, number> }>('/api/admin/content/import'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'projects'] }),
  })

  if (isLoading) return <Loading />
  if (isError || !data)
    return <ErrorState message="مش قادرين نحمل المحتوى." onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-7 text-muted">
          المحتوى بيتكتب في <code>content/</code> داخل Git. الاستيراد بيحدث النصوص والـ checkpoints،
          ومبيغيرش الحالات اللي اخترتها هنا.
        </p>
        <Button
          variant="ghost"
          loading={importContent.isPending}
          onClick={() =>
            window.confirm('استيراد المحتوى من ملفات content/؟') && importContent.mutate()
          }
        >
          <RefreshCw className="size-4" aria-hidden /> استيراد المحتوى
        </Button>
      </Card>
      {importContent.isSuccess && (
        <Notice tone="teal">اتعمل استيراد: {JSON.stringify(importContent.data.report)}</Notice>
      )}
      {importContent.isError && <Notice tone="rose">{errorMessage(importContent.error)}</Notice>}

      {data.map((p) => (
        <Card key={p.id}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold" dir="ltr">
              {p.title}
            </h2>
            <span className="flex items-center gap-2">
              <Badge tone={p.tier === 'PRO' ? 'amber' : 'teal'}>{p.tier}</Badge>
              <StatusControl kind="projects" id={p.id} status={p.status} />
            </span>
          </div>
          <ul className="space-y-4">
            {p.modules.map((m) => (
              <li key={m.id} className="rounded-xl border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {m.order}. {m.title}
                  </h3>
                  <StatusControl kind="modules" id={m.id} status={m.status} />
                </div>
                <ul className="divide-y divide-line">
                  {m.lessons.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {l.title}
                        {l.isPreview && <Badge tone="teal">preview</Badge>}
                      </span>
                      <span className="flex items-center gap-3">
                        <NavLink
                          to={`/admin/lessons/${l.id}`}
                          className="inline-flex items-center gap-1 text-amber-2"
                        >
                          <Eye className="size-3.5" aria-hidden /> معاينة
                        </NavLink>
                        <StatusControl kind="lessons" id={l.id} status={l.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

export function AdminLessonPreview() {
  const { id = '' } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'lesson', id],
    queryFn: () =>
      api.get<{ lesson: LessonView }>(`/api/admin/lessons/${id}/preview`).then((d) => d.lesson),
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <ErrorState message="الدرس مش موجود." />
  return (
    <div className="max-w-3xl">
      <Notice>
        معاينة أدمن. الطلاب مش بيشوفوا الدرس ده غير لما الدرس والموديول والمشروع يبقوا Published.
      </Notice>
      <h2 className="my-8 text-3xl font-bold">{data.title}</h2>
      <Markdown source={data.contentMarkdown} />
      <h3 className="mt-10 mb-4 text-xl font-bold">Checkpoints</h3>
      <ol className="list-decimal space-y-2 ps-6 text-sm">
        {data.checkpoints.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong> — {c.instructions}
          </li>
        ))}
      </ol>
    </div>
  )
}

interface AdminUser {
  id: string
  email: string
  displayName: string
  role: string
  createdAt: string
  enrollments: number
  lessonsCompleted: number
}

export function AdminUsers() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<{ users: AdminUser[] }>('/api/admin/users').then((d) => d.users),
  })
  if (isLoading) return <Loading />
  if (isError || !data)
    return <ErrorState message="مش قادرين نحمل المستخدمين." onRetry={() => refetch()} />
  return (
    <Card className="overflow-x-auto">
      <p className="mb-4 text-sm text-muted">الإيميلات متخفية جزئيًا (least privilege).</p>
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 text-start font-medium">الاسم</th>
            <th className="py-2 text-start font-medium">الإيميل</th>
            <th className="py-2 text-start font-medium">Role</th>
            <th className="py-2 text-start font-medium">مشاريع</th>
            <th className="py-2 text-start font-medium">دروس خلصت</th>
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2">{u.displayName}</td>
              <td className="py-2 font-mono" dir="ltr" style={{ textAlign: 'right' }}>
                {u.email}
              </td>
              <td className="py-2">{u.role}</td>
              <td className="py-2">{u.enrollments}</td>
              <td className="py-2">{u.lessonsCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function AdminOrders() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () =>
      api.get<{
        purchases: {
          id: string
          status: string
          amountMinor: number
          currency: string
          provider: string
        }[]
        activeEntitlements: number
      }>('/api/admin/orders'),
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <ErrorState message="مش قادرين نحمل الطلبات." />
  return (
    <div className="space-y-6">
      <Notice>
        الدفع مش متفعل. مفيش payment provider متوصل، ومفيش checkout. أي entitlement هنا اتعمل يدويًا
        للاختبار بس. التفعيل محتاج موافقتك وموافقة الـ provider (DECISIONS.md D-008).
      </Notice>
      <Card>
        <p className="mb-4">Entitlements نشطة: {data.activeEntitlements}</p>
        {data.purchases.length === 0 ? (
          <p className="text-sm text-muted">مفيش طلبات.</p>
        ) : (
          <ul className="text-sm">
            {data.purchases.map((p) => (
              <li key={p.id}>
                {p.provider} · {p.status} · {p.amountMinor / 100} {p.currency}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function AdminAnalytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () =>
      api.get<{
        funnel: { event: string; count: number }[]
        byCampaign: { campaign: string; event: string; count: number }[]
      }>('/api/admin/analytics'),
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <ErrorState message="مش قادرين نحمل التحليلات." />
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <a
          href="/api/admin/analytics?format=csv"
          className="inline-flex items-center gap-2 rounded-xl border border-line-2 px-4 py-2 text-sm hover:bg-white/5"
        >
          <Download className="size-4" aria-hidden /> CSV (أرقام مجمعة بس)
        </a>
      </div>
      <FunnelTable funnel={data.funnel} />
      <Card>
        <h2 className="mb-4 text-xl font-bold">حسب الحملة (utm_campaign)</h2>
        {data.byCampaign.length === 0 ? (
          <p className="text-sm text-muted">مفيش أحداث بـ UTM لسه.</p>
        ) : (
          <ul className="space-y-1 text-sm" dir="ltr">
            {data.byCampaign.map((c) => (
              <li key={`${c.campaign}-${c.event}`} className="font-mono">
                {c.campaign} · {c.event} · {c.count}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
