import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

  const { data: template } = await supabase
    .from('workflow_templates').select('is_default').eq('id', params.id).single()
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.is_default) {
    return NextResponse.json({ error: 'Cannot edit the default template' }, { status: 400 })
  }

  const body = await req.json()
  const { name, steps } = body

  if (steps !== undefined && !Array.isArray(steps)) {
    return NextResponse.json({ error: 'steps must be an array' }, { status: 400 })
  }

  if (name !== undefined) {
    if (!name?.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    const { error } = await supabase
      .from('workflow_templates').update({ name: name.trim() }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (steps !== undefined) {
    const { error: delErr } = await supabase
      .from('workflow_template_steps').delete().eq('template_id', params.id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (Array.isArray(steps) && steps.length > 0) {
      const rows = (steps as { title: string; collaboration_model?: string; deliverables?: string[] }[])
        .map((s, i) => ({
          template_id: params.id,
          order: i + 1,
          title: s.title,
          collaboration_model: s.collaboration_model ?? 'human-led',
          deliverables: s.deliverables ?? [],
        }))
      const { error: insErr } = await supabase.from('workflow_template_steps').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: t } = await supabase
    .from('workflow_templates').select('is_default').eq('id', params.id).single()
  if (t?.is_default) {
    return NextResponse.json({ error: 'Cannot delete the default template' }, { status: 400 })
  }

  const { error } = await supabase.from('workflow_templates').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
