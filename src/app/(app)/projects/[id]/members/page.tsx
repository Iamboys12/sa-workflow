import { createServerSupabase } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import InviteMemberForm from '@/components/invite-member-form'
import type { ProjectMember, Profile } from '@/lib/types'

type MemberWithProfile = ProjectMember & { profile: Profile | null }

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

      <div className="space-y-2 mb-8">
        {(members as MemberWithProfile[] ?? []).map(m => (
          <div key={m.user_id} className="flex items-center justify-between p-3 border rounded-lg">
            <span className="text-sm">{m.profile?.full_name ?? m.user_id}</span>
            <Badge>{m.role}</Badge>
          </div>
        ))}
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
        <InviteMemberForm projectId={params.id} />
      </div>
    </div>
  )
}
