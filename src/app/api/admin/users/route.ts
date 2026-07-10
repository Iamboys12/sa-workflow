import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/lib/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: users ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { user_id: string; role?: UserRole; is_active?: boolean }
  const { user_id, role, is_active } = body

  if (is_active === false && user_id === user.id) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (is_active !== undefined) updates.is_active = is_active

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (is_active !== undefined) {
    const admin = createAdminSupabase()
    await admin.auth.admin.updateUserById(user_id, {
      ban_duration: is_active ? 'none' : '876600h',
    })
  }

  return NextResponse.json(updated)
}
