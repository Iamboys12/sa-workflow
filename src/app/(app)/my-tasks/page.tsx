import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyTaskList, { type TaskRow } from '@/components/my-task-list'

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

  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', user.id).single()

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

  const tasks: TaskRow[] = (rows ?? []).map(r => {
    const step = r.step as unknown as StepJoin
    return {
      id: r.id,
      title: r.title,
      status: r.status as TaskRow['status'],
      due_date: r.due_date,
      project_step_id: r.project_step_id,
      project_id: step.project_id,
      project_name: step.project?.name ?? '',
      step_title: step.template_step?.title ?? `Step ${step.order}`,
    }
  })

  return (
    <MyTaskList
      tasks={tasks}
      currentUserId={user.id}
      isSA={profile?.role === 'sa'}
    />
  )
}
