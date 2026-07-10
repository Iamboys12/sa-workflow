import { createServerSupabase } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import InviteMemberForm from '@/components/invite-member-form'
import MemberList from '@/components/member-list'
import type { UserRole } from '@/lib/types'

type MemberWithProfile = {
  user_id: string
  role: UserRole
  profile: { id: string; full_name: string } | null
}

export default async function MembersPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'sa') redirect(`/projects/${params.id}`)

  const { data: project } = await supabase
    .from('projects').select('name').eq('id', params.id).single()
  if (!project) notFound()

  const { data: members } = await supabase
    .from('project_members')
    .select('*, profile:profiles(id, full_name, role)')
    .eq('project_id', params.id)

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <Link href={`/projects/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to project
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Members — {project.name}</h1>

      <div className="mb-8">
        <MemberList members={(members as MemberWithProfile[]) ?? []} projectId={params.id} />
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
        <InviteMemberForm projectId={params.id} />
      </div>
    </div>
  )
}
