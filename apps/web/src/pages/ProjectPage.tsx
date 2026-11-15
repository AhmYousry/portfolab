import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Clock, Eye, Lock } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Container } from '../components/Layout'
import { Badge, Button, Card, ErrorState, Loading, Notice } from '../components/ui'
import { ApiRequestError, api, errorMessage } from '../lib/api'
import { analytics } from '../lib/analytics'
import { useMe } from '../lib/auth'
import { usePageTitle } from '../lib/seo'
import { useProject } from '../lib/queries'

export function ProjectPage() {
  const { slug = '' } = useParams()
  const { data: project, isLoading, isError, error, refetch } = useProject(slug)
  const { data: user } = useMe()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const enroll = useMutation({
    mutationFn: () => api.post(`/api/projects/${slug}/enroll`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      const first = project?.modules[0]?.lessons[0]
      navigate(first ? `/projects/${slug}/lessons/${first.slug}` : '/dashboard')
    },
  })

  usePageTitle(project?.title)
  useEffect(() => {
    if (project?.tier === 'PRO')
      analytics.capture('pro_page_viewed', { source: `project:${project.slug}` })
  }, [project?.tier, project?.slug])

  if (isLoading) return <Loading />
  if (isError) {
    const notFound = error instanceof ApiRequestError && error.status === 404
    return (
      <Container>
        <ErrorState
          message={notFound ? 'المشروع ده مش موجود.' : 'مش قادرين نحمل المشروع.'}
          onRetry={notFound ? undefined : () => refetch()}
        />
      </Container>
    )
  }
  if (!project) return null

  const comingSoon = project.status === 'COMING_SOON'
  const isPro = project.tier === 'PRO'

  return (
    <Container>
      <div className="mb-12 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {isPro ? <Badge tone="amber">Pro</Badge> : <Badge tone="teal">مجاني</Badge>}
            {comingSoon && <Badge>قريبًا (Coming soon)</Badge>}
            <Badge>{project.level}</Badge>
          </div>
          <h1
            className="display mb-4"
            dir="ltr"
            style={{ textAlign: 'right', fontSize: 'clamp(2.25rem, 1.5rem + 3vw, 4rem)' }}
          >
            {project.title}
          </h1>
          <p className="mb-4 text-xl text-paper/90">{project.tagline}</p>
          <p className="max-w-2xl leading-8 text-muted">{project.description}</p>
        </div>
        <Card className="h-fit">
          <p className="mb-4 flex items-center gap-2 text-sm text-muted">
            <Clock className="size-4" aria-hidden /> {project.estimatedHours}
          </p>
          {comingSoon ? (
            <Notice>
              المشروع ده لسه بيتبني. هيفضل "قريبًا" لحد ما يبقى كامل ومختبر، ومش متاح للشراء دلوقتي.
            </Notice>
          ) : isPro && !user?.hasPro ? (
            <Notice>المشروع ده جزء من Portfolab Pro.</Notice>
          ) : user ? (
            <>
              <Button
                className="w-full"
                loading={enroll.isPending}
                onClick={() => enroll.mutate()}
                data-attr="project-start"
              >
                <BookOpen className="size-4" aria-hidden /> ابدأ المشروع
              </Button>
              {enroll.isError && (
                <p role="alert" className="mt-3 text-sm text-rose">
                  {errorMessage(enroll.error)}
                </p>
              )}
            </>
          ) : (
            <Link
              to={`/signup?next=${encodeURIComponent(`/projects/${slug}`)}`}
              className="flex w-full items-center justify-center rounded-xl bg-amber px-5 py-3 font-semibold text-ink"
            >
              سجل مجانًا وابدأ
            </Link>
          )}
        </Card>
      </div>

      {project.outcomes.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">هتتعلم</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {project.outcomes.map((o) => (
              <li key={o} className="flex gap-3 leading-7">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-6 text-2xl font-bold">المنهج</h2>
        <ol className="space-y-4">
          {project.modules.map((m) => (
            <li key={m.id}>
              <Card>
                <h3 className="mb-1 text-lg font-semibold">
                  <span className="text-amber">{m.order.toLocaleString('ar-EG')}.</span> {m.title}
                </h3>
                {m.description && <p className="mb-4 text-sm text-muted">{m.description}</p>}
                {m.lessons.length > 0 ? (
                  <ul className="divide-y divide-line">
                    {m.lessons.map((l) => {
                      const open = l.isPreview || Boolean(user)
                      return (
                        <li key={l.id}>
                          <Link
                            to={`/projects/${slug}/lessons/${l.slug}`}
                            className="flex items-center justify-between gap-4 py-3 text-sm hover:text-amber-2"
                          >
                            <span className="flex items-center gap-2">
                              {open ? (
                                <BookOpen className="size-4 text-dim" aria-hidden />
                              ) : (
                                <Lock className="size-4 text-dim" aria-label="محتاج تسجيل" />
                              )}
                              {l.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-dim">
                              {l.isPreview && (
                                <Badge tone="teal">
                                  <Eye className="size-3" aria-hidden /> مفتوح للكل
                                </Badge>
                              )}
                              {l.durationMinutes} د
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-dim">الدروس هتظهر لما الموديول يخلص.</p>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </Container>
  )
}
