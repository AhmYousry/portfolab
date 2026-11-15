import type { ProjectSummary } from '@pb/shared'
import { ArrowLeft, Clock, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from './ui'

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const comingSoon = project.status === 'COMING_SOON'
  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group relative flex h-full flex-col rounded-2xl border border-line bg-ink-2/80 p-6 transition hover:-translate-y-0.5 hover:border-line-2"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {project.tier === 'FREE' ? (
          <Badge tone="teal">مجاني</Badge>
        ) : (
          <Badge tone="amber">Pro</Badge>
        )}
        {comingSoon && (
          <Badge>
            <Lock className="size-3" aria-hidden /> قريبًا (Coming soon)
          </Badge>
        )}
        <Badge>{project.level}</Badge>
      </div>
      <h3 className="mb-2 text-2xl font-bold" dir="ltr" style={{ textAlign: 'right' }}>
        {project.title}
      </h3>
      <p className="mb-2 font-medium text-paper/90">{project.tagline}</p>
      <p className="mb-6 flex-1 text-sm leading-7 text-muted">{project.description}</p>
      <div className="flex items-center justify-between text-sm text-dim">
        <span className="flex items-center gap-1">
          <Clock className="size-4" aria-hidden />
          {project.estimatedHours}
        </span>
        <ArrowLeft className="size-4 transition group-hover:-translate-x-1" aria-hidden />
      </div>
    </Link>
  )
}
