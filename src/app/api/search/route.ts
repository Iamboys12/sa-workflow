import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface TaskJoin {
  project_id: string
  project: { name: string } | null
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status')
  const assignee = searchParams.get('assignee')

  if (q.trim().length < 2) {
    return NextResponse.json({ projects: [], tasks: [] })
  }

  const pattern = `%${q}%`

  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, name, status')
    .ilike('name', pattern)
    .limit(5)

  let taskQuery = supabase
    .from('tasks')
    .select(`
      id, title, status, assigned_to,
      step:project_steps!project_step_id(
        project_id,
        project:projects!project_id(name)
      )
    `)
    .ilike('title', pattern)

  if (status) taskQuery = taskQuery.eq('status', status)
  if (assignee) taskQuery = taskQuery.eq('assigned_to', assignee)

  const { data: taskRows } = await taskQuery.limit(5)

  const tasks = (taskRows ?? []).map(r => {
    const step = r.step as unknown as TaskJoin
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      assigned_to: r.assigned_to,
      project_name: step.project?.name ?? '',
      project_id: step.project_id,
    }
  })

  return NextResponse.json({ projects: projectRows ?? [], tasks })
}
