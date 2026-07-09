import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export interface ProjectProgressData {
  id: string
  name: string
  status: string
  step_count: number
  done_steps: number
  blocked_steps: number
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-800',
}

export default function ProjectProgressCard({ project }: { project: ProjectProgressData }) {
  const pct = project.step_count === 0
    ? 0
    : Math.round((project.done_steps / project.step_count) * 100)

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">{project.name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {project.blocked_steps > 0 && (
              <Badge className="bg-red-100 text-red-700">⚠ blocked</Badge>
            )}
            <Badge className={statusColors[project.status] ?? 'bg-gray-100 text-gray-800'}>
              {project.status}
            </Badge>
          </div>
        </div>
        <div className="space-y-1">
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              data-testid="progress-bar"
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {project.done_steps}/{project.step_count} steps done
          </span>
        </div>
      </div>
    </Link>
  )
}
