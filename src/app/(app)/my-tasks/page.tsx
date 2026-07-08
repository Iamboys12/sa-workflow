import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

const statusStyle: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done:        'bg-green-100 text-green-700',
}

interface StepJoin {
  project_id: string
  order: number
  project: { name: string } | null
  template_step: { title: string } | null
}

export default async function MyTasksPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: rows } = await supabase
    .from('tasks')
    .select(`
      id, title, status, due_date, project_step_id,
      step:project_steps!project_step_id(
        project_id, order,
        project:projects!project_id(name),
        template_step:workflow_template_steps!template_step_id(title)
      )
    `)
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Tasks</h1>

      {(rows ?? []).length === 0 && (
        <p className="text-gray-500">No tasks assigned to you yet.</p>
      )}

      <div className="space-y-3">
        {(rows ?? []).map(t => {
          const step = t.step as unknown as StepJoin
          const projectId = step.project_id
          const projectName = step.project?.name ?? ''
          const stepTitle = step.template_step?.title ?? `Step ${step.order}`
          const isOverdue = t.due_date !== null && t.due_date < today && t.status !== 'done'

          return (
            <div key={t.id} className="p-4 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/projects/${projectId}/steps/${t.project_step_id}`}
                  className="text-sm font-medium hover:underline flex-1"
                >
                  {t.title}
                </Link>
                <Badge className={statusStyle[t.status] ?? 'bg-gray-100 text-gray-700'}>
                  {t.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{projectName} › {stepTitle}</span>
                {t.due_date && (
                  <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    Due {t.due_date}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
