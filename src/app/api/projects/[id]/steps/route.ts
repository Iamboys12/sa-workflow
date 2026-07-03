import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('project_steps')
    .select(`
      *,
      template_step:workflow_template_steps(*),
      tasks(status)
    `)
    .eq('project_id', params.id)
    .order('order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const steps = (data ?? []).map((step: { tasks?: { status: string }[] } & Record<string, unknown>) => {
    const tasks = step.tasks ?? []
    return {
      ...step,
      tasks: undefined,
      task_count: tasks.length,
      done_count: tasks.filter(t => t.status === 'done').length,
    }
  })

  return NextResponse.json(steps)
}
