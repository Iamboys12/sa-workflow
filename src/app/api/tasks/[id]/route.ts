import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const FULL_FIELDS = ['title', 'description', 'status', 'due_date', 'assigned_to']
const ASSIGNEE_FIELDS = ['status']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, status, due_date, project_steps!project_step_id(project_id)')
    .eq('id', params.id)
    .single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projectId = (task.project_steps as unknown as { project_id: string }).project_id

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  let allowedFields: string[]

  if (profile?.role === 'sa') {
    allowedFields = FULL_FIELDS
  } else {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (membership?.role === 'tech_lead') {
      allowedFields = FULL_FIELDS
    } else if (task.assigned_to === user.id) {
      allowedFields = ASSIGNEE_FIELDS
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowedFields.includes(k))
  )

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const activityEvents: Array<{ task_id: string; user_id: string; type: string; meta: unknown }> = []

  if ('status' in updates && updates.status !== task.status) {
    activityEvents.push({ task_id: params.id, user_id: user.id, type: 'status_change', meta: { from: task.status, to: updates.status } })
  }
  if ('assigned_to' in updates && updates.assigned_to !== task.assigned_to) {
    activityEvents.push({ task_id: params.id, user_id: user.id, type: 'assigned', meta: { from_user_id: task.assigned_to ?? null, to_user_id: updates.assigned_to ?? null } })
  }
  if ('due_date' in updates && updates.due_date !== task.due_date) {
    activityEvents.push({ task_id: params.id, user_id: user.id, type: 'due_date_set', meta: { from: task.due_date ?? null, to: updates.due_date ?? null } })
  }

  if (activityEvents.length > 0) {
    await supabase.from('task_events').insert(activityEvents)
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
