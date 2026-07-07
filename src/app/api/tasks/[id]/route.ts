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
    .select('assigned_to, project_steps!project_step_id(project_id)')
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
