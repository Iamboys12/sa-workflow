import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { ProjectStatus } from '@/lib/types'

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  active:    ['completed', 'archived'],
  completed: ['active', 'archived'],
  archived:  ['active'],
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: project } = await supabase
    .from('projects').select('created_by, status').eq('id', params.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.created_by !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json() as { status: ProjectStatus }
  const allowed = VALID_TRANSITIONS[project.status as ProjectStatus] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${project.status} to ${status}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('projects').update({ status }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
