import {
  ArrowLeft,
  Bug,
  Database,
  FileCheck2,
  GitBranch,
  MessageSquareCode,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'
import { Container } from '../components/Layout'
import { ProjectCard } from '../components/ProjectCard'
import { Badge, ButtonLink, Card, Loading } from '../components/ui'
import { trackEvent } from '../lib/analytics'
import { useMe } from '../lib/auth'
import { useProjects } from '../lib/queries'

const PAINS = [
  {
    title: '17 calculator app',
    body: 'كلهم شبه بعض، وكلهم frontend بس. الإنترفيور سأل "الداتا بتتخزن فين؟" وأحمد سكت.',
  },
  {
    title: 'Claude كتبه، أحمد مش فاهمه',
    body: 'الكود شغال، بس أول سؤال "ليه عملت كده؟" بيكشف كل حاجة.',
  },
  {
    title: '.env على GitHub',
    body: 'باسورد الداتابيز اتنشر public. بعد ساعتين bot كان بيجرب يدخل.',
  },
]

const OUTCOMES = [
  {
    icon: Database,
    title: 'Full stack حقيقي',
    body: 'React وExpress وPostgreSQL مربوطين ببعض، والبيانات بتعيش بعد الـ refresh.',
  },
  {
    icon: ShieldCheck,
    title: 'Validation وأمان',
    body: 'Zod على الـ server، أخطاء مبتكشفش تفاصيل، ومفيش secrets في الـ repo.',
  },
  {
    icon: Bug,
    title: 'Tests بتثبت',
    body: 'Integration tests بـ Vitest وSupertest، مش screenshots وخلاص.',
  },
  {
    icon: MessageSquareCode,
    title: 'AI كـ mentor',
    body: '10 prompts بتخلي الـ AI يسألك ويراجعك بدل ما يكتب المشروع مكانك.',
  },
  {
    icon: FileCheck2,
    title: 'Checkpoints',
    body: 'كل درس بيخلص بحاجة تقدر تشوفها أو تختبرها، مش "حسيت إني فهمت".',
  },
  {
    icon: GitBranch,
    title: 'تشرحه بثقة',
    body: 'README صادق، tradeoffs مكتوبة، وأسئلة إنترفيو جاوبت عليها بنفسك.',
  },
]

const HONEST = [
  'مش bootcamp ومش هنعلمك JavaScript من الصفر. لازم تعرف الأساسيات.',
  'مفيش ضمان توظيف. اللي بنضمنه إنك هتبني حاجة حقيقية وتفهمها.',
  'مشاريع Pro لسه بتتبني. هتفضل "قريبًا" لحد ما تبقى كاملة ومختبرة، ومش هنبيعها قبل كده.',
  'التقديرات الزمنية مبدئية وهنراجعها مع أول دفعة طلاب.',
]

export function Landing() {
  const { data: user } = useMe()
  const { data: projects, isLoading } = useProjects()

  useEffect(() => {
    trackEvent('landing_view', '/')
  }, [])

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="mesh hero-parallax absolute inset-0 -z-10" aria-hidden />
        <Container className="pb-20 pt-20 sm:pt-28">
          <div className="reveal max-w-4xl">
            <Badge tone="amber">من سلسلة Ahmed & Claude</Badge>
            <h1 className="display mt-6">
              بطّل تتفرج على tutorials.
              <br />
              <span className="bg-gradient-to-l from-amber via-amber-2 to-teal bg-clip-text text-transparent">
                ابدأ تبني.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-9 text-muted sm:text-xl">
              مشاريع Full Stack حقيقية تبنيها خطوة بخطوة، تختبرها، تنشرها، وتشرحها في الإنترفيو. أول
              مشروع كامل <strong className="text-paper">مجاني</strong> ومن غير كارت.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <ButtonLink
                to={user ? '/dashboard' : '/signup'}
                onClick={() => trackEvent('free_cta_click', '/')}
                className="px-7 py-4 text-base"
              >
                {user ? 'كمّل من مكانك' : 'ابدأ TaskFlow Lite مجانًا'}
                <ArrowLeft className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink
                to="/projects/taskflow-lite/lessons/why-taskflow"
                variant="ghost"
                className="px-7 py-4 text-base"
              >
                اقرا أول درس من غير حساب
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        <h2 className="mb-8 text-3xl font-bold">مألوفة؟</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PAINS.map((p) => (
            <Card key={p.title} className="hero-tilt">
              <h3 className="mb-2 text-lg font-semibold text-amber-2">{p.title}</h3>
              <p className="leading-7 text-muted">{p.body}</p>
            </Card>
          ))}
        </div>
      </Container>

      <Container>
        <div className="mb-10 max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold">هتطلع بإيه من TaskFlow Lite</h2>
          <p className="text-lg leading-8 text-muted">
            6 موديولز، 12 درس، وcheckpoints في كل خطوة. لمستوى بيعرف JavaScript وعايز أول مشروع full
            stack يقدر يقف وراه.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <Icon className="mb-4 size-6 text-teal" aria-hidden />
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-7 text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Container>

      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold">المشاريع</h2>
          <ButtonLink to="/curriculum" variant="quiet" className="px-0">
            شوف المنهج كامل <ArrowLeft className="size-4" aria-hidden />
          </ButtonLink>
        </div>
        {isLoading ? (
          <Loading />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects?.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </Container>

      <Container>
        <Card className="border-amber/30">
          <h2 className="mb-6 text-2xl font-bold">بصراحة</h2>
          <ul className="space-y-3">
            {HONEST.map((h) => (
              <li key={h} className="flex gap-3 leading-7 text-paper/90">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </>
  )
}
