import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import TaskList from '@/components/task-list'
import StepStatusSelect from '@/components/step-status-select'

const modelColors: Record<string, string> = {
  'human-led':   'bg-purple-100 text-purple-700',
  'ai-assisted': 'bg-orange-100 text-orange-700',
  'paired':      'bg-teal-100 text-teal-700',
}

export default async function StepDetailPage({
  params,
}: {
  params: { id: string; stepId: string }
}) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const { data: step } = await supabase
    .from('project_steps')
    .select('*, template_step:workflow_template_steps(*)')
    .eq('id', params.stepId)
    .single()

  if (!step) notFound()

  const title = step.template_step?.title ?? `Step ${step.order}`
  const model = step.template_step?.collaboration_model
  const deliverables: string[] = step.template_step?.deliverables ?? []
  const isSA = profile?.role === 'sa'

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href={`/projects/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to project
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-gray-400 text-sm">Step {step.order}</span>
        <h1 className="text-2xl font-bold">{title}</h1>
        {model && <Badge className={modelColors[model]}>{model}</Badge>}
        {isSA && (
          <StepStatusSelect
            projectId={params.id}
            stepId={params.stepId}
            status={step.status}
          />
        )}
      </div>

      {deliverables.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Expected Deliverables</h2>
          <ul className="space-y-1">
            {deliverables.map((d, i) => (
              <li key={i} className="text-sm text-gray-700">• {d}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Tasks</h2>
        <TaskList stepId={step.id} isSA={isSA} />
      </div>
    </div>
  )
}
