import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserList from '@/components/user-list'
import type { Profile } from '@/lib/types'

export default async function UsersPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'sa') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('full_name')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">System Users</h1>
      <UserList users={(users ?? []) as Profile[]} currentUserId={user!.id} />
    </div>
  )
}
