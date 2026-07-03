import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('workflow_templates')
    .update({ name: name.trim() })
    .eq('id', params.id)
    .select().single()

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

  const { data: t } = await supabase
    .from('workflow_templates').select('is_default').eq('id', params.id).single()
  if (t?.is_default) {
    return NextResponse.json({ error: 'Cannot delete the default template' }, { status: 400 })
  }

  const { error } = await supabase.from('workflow_templates').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
