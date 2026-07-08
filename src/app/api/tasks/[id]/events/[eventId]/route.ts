import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; eventId: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isSA = profile?.role === 'sa'

  const { data: event } = await supabase
    .from('task_events')
    .select('id, user_id, type')
    .eq('id', params.eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (event.type !== 'comment') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isSA && event.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('task_events').delete().eq('id', params.eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
