import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProjectStep } from '@/lib/types'

const statusConfig = {
  not_started: { label: '○', bg: 'bg-gray-50 border-gray-200' },
  in_progress:  { label: '◑', bg: 'bg-blue-50 border-blue-200' },
  blocked:      { label: '⊘', bg: 'bg-red-50 border-red-200' },
  done:         { label: '✓', bg: 'bg-green-50 border-green-200' },
}

const modelColors: Record<string, string> = {
  'human-led':   'bg-purple-100 text-purple-700',
  'ai-assisted': 'bg-orange-100 text-orange-700',
  'paired':      'bg-teal-100 text-teal-700',
}

export default function StepCard({
  step,
  projectId,
}: {
  step: ProjectStep
  projectId: string
}) {
  const config = statusConfig[step.status]
  const title = step.template_step?.title ?? `Step ${step.order}`
  const model = step.template_step?.collaboration_model

  return (
    <Link href={`/projects/${projectId}/steps/${step.id}`}>
      <div className={cn(
        'border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer h-full',
        config.bg
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Step {step.order}</span>
          <span className="text-lg">{config.label}</span>
        </div>
        <h3 className="font-medium text-sm mb-2 leading-tight">{title}</h3>
        {model && (
          <Badge className={cn('text-xs mb-2', modelColors[model])}>{model}</Badge>
        )}
        <p className="text-xs text-gray-500 mt-auto">
          {step.done_count} / {step.task_count} tasks
        </p>
      </div>
    </Link>
  )
}
