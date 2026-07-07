import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface StepJoin {
  project_id: string
  order: number
  project: { name: string } | null
  template_step: { title: string; order: number } | null
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('tasks')
    .select(`
      id, title, status, due_date, project_step_id,
      step:project_steps!project_step_id(
        project_id, order,
        project:projects!project_id(name),
        template_step:workflow_template_steps!template_step_id(title, order)
      )
    `)
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tasks = (rows ?? []).map(t => {
    const step = t.step as unknown as StepJoin
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      project_step_id: t.project_step_id,
      project_id: step.project_id,
      project_name: step.project?.name ?? '',
      step_title: step.template_step?.title ?? `Step ${step.order}`,
      step_order: step.order,
    }
  })

  return NextResponse.json(tasks)
}
