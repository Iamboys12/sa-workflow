import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface TaskRow {
  project_step_id: string
  project_steps: { project_id: string }
}

async function getMembershipCheck(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  taskId: string
): Promise<{ allowed: boolean; projectId: string }> {
  const { data: task } = await supabase
    .from('tasks')
    .select('project_step_id, project_steps!project_step_id(project_id)')
    .eq('id', taskId)
    .single()

  if (!task) return { allowed: false, projectId: '' }

  const projectId = (task as unknown as TaskRow).project_steps.project_id

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userId).single()

  if (profile?.role === 'sa') return { allowed: true, projectId }

  const { data: member } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  return { allowed: !!member, projectId }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await getMembershipCheck(supabase, user.id, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: events, error } = await supabase
    .from('task_events')
    .select('*, author:profiles!user_id(full_name)')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve assignee names for 'assigned' events
  const userIds = new Set<string>()
  for (const e of events ?? []) {
    if (e.type === 'assigned' && e.meta) {
      const m = e.meta as { from_user_id?: string; to_user_id?: string }
      if (m.from_user_id) userIds.add(m.from_user_id)
      if (m.to_user_id) userIds.add(m.to_user_id)
    }
  }

  const profileMap: Record<string, string> = {}
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name').in('id', [...userIds])
    for (const p of profiles ?? []) profileMap[p.id] = p.full_name
  }

  const shaped = (events ?? []).map(e => {
    const author = e.author as { full_name: string } | null
    let meta = e.meta as Record<string, unknown> | null
    if (e.type === 'assigned' && meta) {
      const m = meta as { from_user_id?: string; to_user_id?: string }
      meta = {
        ...meta,
        from_user_name: m.from_user_id ? (profileMap[m.from_user_id] ?? null) : null,
        to_user_name: m.to_user_id ? (profileMap[m.to_user_id] ?? null) : null,
      }
    }
    return {
      id: e.id,
      task_id: e.task_id,
      user_id: e.user_id,
      user_name: author?.full_name ?? '',
      type: e.type,
      body: e.body ?? null,
      meta,
      created_at: e.created_at,
    }
  })

  return NextResponse.json(shaped)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate body before expensive membership DB queries
  const reqBody = await req.json()
  if (!reqBody.body?.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const { allowed } = await getMembershipCheck(supabase, user.id, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: event, error } = await supabase
    .from('task_events')
    .insert({ task_id: params.id, user_id: user.id, type: 'comment', body: reqBody.body.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Shape response to match TaskEvent (user_name required)
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  return NextResponse.json({
    ...event,
    user_name: profile?.full_name ?? '',
  }, { status: 201 })
}
