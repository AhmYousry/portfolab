import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LessonView } from '@pb/shared'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Lock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { Container } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { Badge, ButtonLink, Card, ErrorState, Loading, Notice, TrackedLink } from '../components/ui'
import { ApiRequestError, api, errorMessage } from '../lib/api'
import { analytics, trackClick } from '../lib/analytics'
import { useMe } from '../lib/auth'
import { useLesson } from '../lib/queries'
import { usePageTitle } from '../lib/seo'

function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className="rounded border border-line bg-ink-3 px-1.5 py-0.5 text-[0.85em] text-paper/90"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function Checkpoints({
  lesson,
  canTrack,
  queryKey,
}: {
  lesson: LessonView
  canTrack: boolean
  queryKey: unknown[]
}) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.put(`/api/checkpoints/${id}/progress`, {
        status: completed ? 'COMPLETED' : 'NOT_STARTED',
      }),
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<LessonView>(queryKey)
      if (previous) {
        qc.setQueryData<LessonView>(queryKey, {
          ...previous,
          checkpoints: previous.checkpoints.map((c) => (c.id === id ? { ...c, completed } : c)),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['progress'] })
      void qc.invalidateQueries({ queryKey: ['resources'] })
    },
  })

  if (lesson.checkpoints.length === 0) return null
  const done = lesson.checkpoints.filter((c) => c.completed).length

  return (
    <Card className="mt-12 border-teal/30">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Checkpoints</h2>
        <span className="text-sm text-muted" aria-live="polite">
          {done} من {lesson.checkpoints.length}
        </span>
      </div>
      {!canTrack && (
        <div className="mb-6">
          <Notice tone="teal">
            <TrackedLink
              to="/signup"
              className="font-semibold text-teal underline"
              analyticsId="lesson-locked-signup"
            >
              سجل مجانًا
            </TrackedLink>{' '}
            عشان تحفظ تقدمك وتفتح باقي الدروس.
          </Notice>
        </div>
      )}
      <ul className="space-y-4">
        {lesson.checkpoints.map((c) => (
          <li key={c.id}>
            <label
              className={`flex gap-4 rounded-xl border p-4 transition ${c.completed ? 'border-teal/40 bg-teal/5' : 'border-line'} ${canTrack ? 'cursor-pointer hover:border-line-2' : 'opacity-70'}`}
            >
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[var(--color-teal)]"
                checked={c.completed}
                disabled={!canTrack}
                onChange={(e) => {
                  if (e.target.checked) {
                    trackClick('checkpoint-toggle', {
                      project_id: lesson.project.slug,
                      lesson_id: lesson.slug,
                    })
                  }
                  toggle.mutate({ id: c.id, completed: e.target.checked })
                }}
                data-analytics-id="checkpoint-toggle"
              />
              <span>
                <span className="mb-1 block font-semibold">{c.title}</span>
                <span className="block text-sm leading-7 text-muted">
                  <InlineCode text={c.instructions} />
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {toggle.isError && (
        <p role="alert" className="mt-4 text-sm text-rose">
          {errorMessage(toggle.error)}
        </p>
      )}
      {done === lesson.checkpoints.length && (
        <p className="mt-6 flex items-center gap-2 font-semibold text-ok" role="status">
          <CheckCircle2 className="size-5" aria-hidden /> الدرس خلص. برافو.
        </p>
      )}
    </Card>
  )
}

export function LessonPage() {
  const { slug = '', lessonSlug = '' } = useParams()
  const { data: user, isLoading: meLoading } = useMe()
  const userKey = user?.id ?? 'anon'
  const { data: lesson, isLoading, isError, error, refetch } = useLesson(slug, lessonSlug, userKey)
  const queryKey = ['lesson', slug, lessonSlug, userKey]
  const qc = useQueryClient()
  const started = useRef<string | null>(null)
  usePageTitle(lesson?.title)

  useEffect(() => {
    if (!lesson || started.current === lesson.id) return
    started.current = lesson.id
    // lesson_started is emitted once per user+lesson by the server when progress is first written.
    // Anonymous preview readers get a separate event so they never inflate the learning funnel.
    if (!user) {
      analytics.capture('lesson_previewed', { project_id: slug, lesson_id: lessonSlug })
      return
    }
    if (lesson.progressStatus === null) {
      void api
        .put(`/api/lessons/${lesson.id}/progress`, { status: 'IN_PROGRESS' })
        .then(() => {
          void qc.invalidateQueries({ queryKey: ['lesson', slug, lessonSlug] })
          void qc.invalidateQueries({ queryKey: ['dashboard'] })
        })
        .catch(() => undefined)
    }
  }, [lesson, user, qc, slug, lessonSlug])

  if (meLoading || isLoading) return <Loading />
  if (isError) {
    const status = error instanceof ApiRequestError ? error.status : 0
    if (status === 401) {
      return (
        <Container className="max-w-xl text-center">
          <Lock className="mx-auto mb-4 size-8 text-amber" aria-hidden />
          <h1 className="mb-3 text-2xl font-bold">الدرس ده محتاج حساب مجاني</h1>
          <p className="mb-8 text-muted">
            سجل في دقيقة، من غير كارت، وكمّل المشروع كله وتقدمك يتحفظ.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink
              to={`/signup?next=${encodeURIComponent(`/projects/${slug}/lessons/${lessonSlug}`)}`}
              analyticsId="lesson-locked-signup"
              analyticsProps={{ project_id: slug, lesson_id: lessonSlug }}
            >
              سجل مجانًا
            </ButtonLink>
            <ButtonLink
              to={`/login?next=${encodeURIComponent(`/projects/${slug}/lessons/${lessonSlug}`)}`}
              variant="ghost"
              analyticsId="lesson-locked-login"
              analyticsProps={{ project_id: slug, lesson_id: lessonSlug }}
            >
              عندي حساب
            </ButtonLink>
          </div>
        </Container>
      )
    }
    if (status === 403) {
      return (
        <Container className="max-w-xl text-center">
          <Lock className="mx-auto mb-4 size-8 text-amber" aria-hidden />
          <h1 className="mb-3 text-2xl font-bold">الدرس ده جزء من Pro</h1>
          <ButtonLink
            to="/pricing"
            variant="ghost"
            analyticsId="lesson-pro-pricing"
            analyticsProps={{ project_id: slug, lesson_id: lessonSlug }}
          >
            شوف التفاصيل
          </ButtonLink>
        </Container>
      )
    }
    return (
      <Container>
        <ErrorState
          message={status === 404 ? 'الدرس ده مش موجود.' : 'مش قادرين نحمل الدرس.'}
          onRetry={status === 404 ? undefined : () => refetch()}
        />
      </Container>
    )
  }
  if (!lesson) return null

  return (
    <Container className="max-w-3xl">
      <nav aria-label="مسار التنقل" className="mb-8 text-sm text-dim">
        <TrackedLink
          to={`/projects/${slug}`}
          className="hover:text-paper"
          analyticsId="lesson-breadcrumb-project"
          analyticsProps={{ project_id: slug, lesson_id: lessonSlug }}
        >
          {lesson.project.title}
        </TrackedLink>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span>{lesson.module.title}</span>
      </nav>

      <header className="mb-10">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge>
            <Clock className="size-3" aria-hidden /> {lesson.durationMinutes} دقيقة
          </Badge>
          {lesson.isPreview && <Badge tone="teal">درس مفتوح للكل</Badge>}
          {lesson.progressStatus === 'COMPLETED' && (
            <Badge tone="ok">
              <CheckCircle2 className="size-3" aria-hidden /> خلص
            </Badge>
          )}
          {lesson.progressStatus === 'IN_PROGRESS' && (
            <Badge tone="amber">
              <Circle className="size-3" aria-hidden /> شغال فيه
            </Badge>
          )}
        </div>
        <h1 className="text-[clamp(1.9rem,1.3rem+2.2vw,3rem)] font-bold leading-tight">
          {lesson.title}
        </h1>
      </header>

      <Markdown
        source={lesson.contentMarkdown}
        onCodeAction={(action, block) => {
          const context = { project_id: slug, lesson_id: lessonSlug }
          if (action === 'reveal') {
            trackClick('code-spoiler-toggle', context)
            analytics.capture('feature_used', {
              feature_name: 'spoiler_revealed',
              source: lessonSlug,
            })
            return
          }
          trackClick('code-copy', context)
          if (block.promptId) {
            analytics.capture('prompt_copied', {
              ...context,
              prompt_id: block.promptId,
              feature_name: 'lesson_prompt',
            })
          } else {
            analytics.capture('feature_used', { feature_name: 'code_copied', source: lessonSlug })
          }
        }}
      />

      <Checkpoints lesson={lesson} canTrack={Boolean(user)} queryKey={queryKey} />

      <nav className="mt-12 grid gap-4 sm:grid-cols-2" aria-label="التنقل بين الدروس">
        {lesson.prev ? (
          <TrackedLink
            to={`/projects/${slug}/lessons/${lesson.prev.slug}`}
            className="rounded-xl border border-line p-4 hover:border-line-2"
            analyticsId="lesson-prev"
            analyticsProps={{ project_id: slug, lesson_id: lesson.prev.slug }}
          >
            <span className="mb-1 flex items-center gap-1 text-xs text-dim">
              <ArrowRight className="size-3" aria-hidden /> السابق
            </span>
            <span className="font-medium">{lesson.prev.title}</span>
          </TrackedLink>
        ) : (
          <span />
        )}
        {lesson.next && (
          <TrackedLink
            to={`/projects/${slug}/lessons/${lesson.next.slug}`}
            className="rounded-xl border border-line p-4 text-end hover:border-line-2"
            analyticsId="lesson-next"
            analyticsProps={{ project_id: slug, lesson_id: lesson.next.slug }}
          >
            <span className="mb-1 flex items-center justify-end gap-1 text-xs text-dim">
              التالي <ArrowLeft className="size-3" aria-hidden />
            </span>
            <span className="font-medium">{lesson.next.title}</span>
          </TrackedLink>
        )}
      </nav>
    </Container>
  )
}
