import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { StepStatus } from '@/lib/types'

const VALID: StepStatus[] = ['not_started', 'in_progress', 'blocked', 'done']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json() as { status: StepStatus }
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_steps')
    .update({ status })
    .eq('id', params.stepId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
