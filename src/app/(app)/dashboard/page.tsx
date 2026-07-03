import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ProjectCard from '@/components/project-card'
import type { Project } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const { data: projects } = await supabase
    .from('projects').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        {profile?.role === 'sa' && (
          <Link href="/projects/new">
            <Button>+ New Project</Button>
          </Link>
        )}
      </div>

      {!projects?.length ? (
        <p className="text-gray-500">
          No projects yet.{profile?.role === 'sa' && ' Create your first project above.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: Project) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
