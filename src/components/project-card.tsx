import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ProjectCardActions from '@/components/project-card-actions'
import type { Project } from '@/lib/types'

const statusColors: Record<string, string> = {
  active:    'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  archived:  'bg-gray-100 text-gray-800',
}

export default function ProjectCard({
  project,
  isSA = false,
  userId = '',
}: {
  project: Project
  isSA?: boolean
  userId?: string
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <div className="flex items-center gap-1">
              <Badge className={statusColors[project.status]}>{project.status}</Badge>
              {isSA && project.created_by === userId && (
                <ProjectCardActions project={project} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 line-clamp-2">
            {project.description || 'No description'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
