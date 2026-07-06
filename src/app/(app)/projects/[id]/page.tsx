import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import WorkflowBoard from '@/components/workflow-board'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).single()

  if (!project) notFound()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const isSA = profile?.role === 'sa'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge>{project.status}</Badge>
          {isSA && (
            <Link href={`/projects/${project.id}/members`}>
              <Button variant="outline" size="sm">Manage Members</Button>
            </Link>
          )}
        </div>
      </div>
      <WorkflowBoard projectId={project.id} isSA={isSA} />
    </div>
  )
}
