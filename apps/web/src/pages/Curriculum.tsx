import { Container } from '../components/Layout'
import { ProjectCard } from '../components/ProjectCard'
import { ErrorState, Loading, PageHeader } from '../components/ui'
import { isFreeLaunch, visibleCatalog } from '../lib/launch'
import { useProjects } from '../lib/queries'

export function Curriculum() {
  const { data: projects, isLoading, isError, refetch } = useProjects()
  const freeLaunch = isFreeLaunch()

  return (
    <Container>
      {freeLaunch ? (
        <PageHeader eyebrow="المنهج" title="TaskFlow Lite: أول مشروع full stack كامل ومجاني">
          البيتا العامة مركزة على مشروع واحد كامل ومختبر. سجل مجانًا وابدأ من أول درس.
        </PageHeader>
      ) : (
        <PageHeader eyebrow="المنهج" title="مشروع ورا مشروع، كل واحد أعمق من اللي قبله">
          ابدأ بـ TaskFlow Lite المجاني. مشاريع Pro بتنزل واحد واحد بعد ما تتبني وتتختبر بالكامل.
        </PageHeader>
      )}
      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل المشاريع." onRetry={() => refetch()} />}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleCatalog(projects ?? []).map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </Container>
  )
}
