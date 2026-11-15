import { Container } from '../components/Layout'
import { ProjectCard } from '../components/ProjectCard'
import { ErrorState, Loading, PageHeader } from '../components/ui'
import { useProjects } from '../lib/queries'

export function Curriculum() {
  const { data: projects, isLoading, isError, refetch } = useProjects()

  return (
    <Container>
      <PageHeader eyebrow="المنهج" title="مشروع ورا مشروع، كل واحد أعمق من اللي قبله">
        ابدأ بـ TaskFlow Lite المجاني. مشاريع Pro بتنزل واحد واحد بعد ما تتبني وتتختبر بالكامل.
      </PageHeader>
      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل المشاريع." onRetry={() => refetch()} />}
      <div className="grid gap-4 md:grid-cols-2">
        {projects?.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </Container>
  )
}
