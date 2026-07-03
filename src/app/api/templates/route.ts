import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*')
    .order('is_default', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, steps } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data: template, error: tErr } = await supabase
    .from('workflow_templates')
    .insert({ name: name.trim(), created_by: user.id })
    .select().single()

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  if (steps?.length) {
    const stepRows = (steps as { order?: number; title: string; collaboration_model?: string; deliverables?: string[] }[])
      .map((s, i) => ({
        template_id: template.id,
        order: s.order ?? i + 1,
        title: s.title,
        collaboration_model: s.collaboration_model ?? 'human-led',
        deliverables: s.deliverables ?? [],
      }))
    const { error: sErr } = await supabase.from('workflow_template_steps').insert(stepRows)
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  return NextResponse.json(template, { status: 201 })
}
