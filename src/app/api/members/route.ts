import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('project_members')
    .select('*, profile:profiles(id, full_name, role)')
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requesterProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requesterProfile?.role !== 'sa') {
    return NextResponse.json({ error: 'Only SA can invite members' }, { status: 403 })
  }

  const body = await req.json()
  const { project_id, email, role } = body

  if (!['pm', 'tech_lead'].includes(role)) {
    return NextResponse.json({ error: 'role must be pm or tech_lead' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: { users } } = await admin.auth.admin.listUsers()
  const invitee = users.find(u => u.email === email)
  if (!invitee) {
    return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('project_members')
    .insert({ project_id, user_id: invitee.id, role })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { project_id: string; user_id: string; role: string }
  const { project_id, user_id, role } = body

  if (!['pm', 'tech_lead'].includes(role)) {
    return NextResponse.json({ error: 'role must be pm or tech_lead' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', project_id)
    .eq('user_id', user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { project_id, user_id } = body

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', project_id)
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
