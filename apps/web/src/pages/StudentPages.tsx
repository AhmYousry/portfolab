import { ArrowLeft, CheckCircle2, Circle, CircleDot, Download, FileText, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '../components/Layout'
import {
  Badge,
  ButtonLink,
  Card,
  ErrorState,
  Loading,
  PageHeader,
  ProgressBar,
} from '../components/ui'
import { useMe } from '../lib/auth'
import { useDashboard, useProgress, useResources } from '../lib/queries'

export function Dashboard() {
  const { data: user } = useMe()
  const { data, isLoading, isError, refetch } = useDashboard()

  return (
    <Container>
      <PageHeader eyebrow="لوحتك" title={`أهلًا يا ${user?.displayName ?? ''}`} />
      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل لوحتك." onRetry={() => refetch()} />}
      {data && data.projects.length === 0 && (
        <Card className="max-w-2xl">
          <h2 className="mb-2 text-xl font-bold">لسه مبدأتش مشروع</h2>
          <p className="mb-6 text-muted">
            ابدأ بـ TaskFlow Lite: أول مشروع full stack كامل ومجاني.
          </p>
          <ButtonLink to="/projects/taskflow-lite">ابدأ TaskFlow Lite</ButtonLink>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {data?.projects.map((p) => (
          <Card key={p.project.slug}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" dir="ltr" style={{ textAlign: 'right' }}>
                  {p.project.title}
                </h2>
                <p className="text-sm text-muted">{p.project.tagline}</p>
              </div>
              <span className="text-2xl font-bold text-amber">{p.percent}%</span>
            </div>
            <ProgressBar percent={p.percent} label={`تقدمك في ${p.project.title}`} />
            <p className="mt-3 text-sm text-dim">
              {p.completedLessons} من {p.totalLessons} درس
            </p>
            {p.nextLesson ? (
              <div className="mt-6 rounded-xl border border-line p-4">
                <p className="mb-1 text-xs text-dim">الخطوة الجاية · {p.nextLesson.moduleTitle}</p>
                <p className="mb-4 font-semibold">{p.nextLesson.title}</p>
                <ButtonLink to={`/projects/${p.project.slug}/lessons/${p.nextLesson.slug}`}>
                  كمّل <ArrowLeft className="size-4" aria-hidden />
                </ButtonLink>
              </div>
            ) : (
              <p className="mt-6 flex items-center gap-2 font-semibold text-ok">
                <CheckCircle2 className="size-5" aria-hidden /> خلصت المشروع كله.
              </p>
            )}
          </Card>
        ))}
      </div>
      {data && data.stats.completedCheckpoints > 0 && (
        <p className="mt-8 text-sm text-dim">
          خلصت {data.stats.completedCheckpoints} checkpoint لحد دلوقتي.
        </p>
      )}
    </Container>
  )
}

const STATUS_ICON = {
  COMPLETED: <CheckCircle2 className="size-4 text-ok" aria-label="خلص" />,
  IN_PROGRESS: <CircleDot className="size-4 text-amber" aria-label="شغال فيه" />,
  NOT_STARTED: <Circle className="size-4 text-dim" aria-label="لسه" />,
} as const

export function Progress() {
  const { data, isLoading, isError, refetch } = useProgress()

  return (
    <Container className="max-w-3xl">
      <PageHeader eyebrow="التقدم" title="أنت فين في كل مشروع" />
      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل التقدم." onRetry={() => refetch()} />}
      {data?.length === 0 && (
        <p className="text-muted">
          لسه مفيش تقدم.{' '}
          <Link to="/projects/taskflow-lite" className="text-amber-2">
            ابدأ أول مشروع
          </Link>
          .
        </p>
      )}
      {data?.map((p) => {
        const modules = new Map<string, typeof p.lessons>()
        for (const l of p.lessons)
          modules.set(l.moduleTitle, [...(modules.get(l.moduleTitle) ?? []), l])
        return (
          <section key={p.project.slug} className="mb-12">
            <h2 className="mb-2 text-2xl font-bold" dir="ltr" style={{ textAlign: 'right' }}>
              {p.project.title}
            </h2>
            <ProgressBar percent={p.percent} label={`تقدمك في ${p.project.title}`} />
            <div className="mt-6 space-y-4">
              {[...modules.entries()].map(([title, lessons]) => (
                <Card key={title}>
                  <h3 className="mb-3 font-semibold">{title}</h3>
                  <ul className="space-y-2">
                    {lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          to={`/projects/${p.project.slug}/lessons/${l.slug}`}
                          className="flex items-center gap-3 text-sm hover:text-amber-2"
                        >
                          {STATUS_ICON[l.status as keyof typeof STATUS_ICON] ??
                            STATUS_ICON.NOT_STARTED}
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </Container>
  )
}

export function Resources() {
  const { data, isLoading, isError, refetch } = useResources()

  return (
    <Container className="max-w-3xl">
      <PageHeader eyebrow="الملفات" title="Templates وchecklists وrepos">
        كل الملفات دي جزء من المشروع المجاني. الـ reference solution بيتفتح بعد ما تخلص checkpoints
        الـ API.
      </PageHeader>
      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل الملفات." onRetry={() => refetch()} />}
      <ul className="space-y-4">
        {data?.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <FileText className="mt-1 size-5 shrink-0 text-teal" aria-hidden />
                <div>
                  <h2 className="font-semibold" dir="auto">
                    {r.title}
                  </h2>
                  <p className="text-sm leading-7 text-muted">{r.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge>{r.type}</Badge>
                    {r.tier === 'PRO' && <Badge tone="amber">Pro</Badge>}
                  </div>
                </div>
              </div>
              {r.locked ? (
                <span className="flex shrink-0 items-center gap-2 text-sm text-dim">
                  <Lock className="size-4" aria-hidden /> {r.lockReason}
                </span>
              ) : (
                <a
                  href={`/api/resources/${r.id}/download`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line-2 px-4 py-2 text-sm hover:bg-white/5"
                >
                  <Download className="size-4" aria-hidden /> تحميل
                </a>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  )
}
