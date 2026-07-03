import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stepId = req.nextUrl.searchParams.get('step_id')
  if (!stepId) return NextResponse.json({ error: 'step_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee:profiles!assigned_to(id, full_name)')
    .eq('project_step_id', stepId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { project_step_id, title, description, due_date } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_step_id,
      title: title.trim(),
      description: description ?? '',
      due_date: due_date ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
