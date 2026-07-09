import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/stat-card'
import ProjectProgressCard, { type ProjectProgressData } from '@/components/project-progress-card'
import OverdueAlert, { type OverdueTask } from '@/components/overdue-alert'
import WorkloadList, { type WorkloadEntry } from '@/components/workload-list'
import MyTaskSummary from '@/components/my-task-summary'
import UpcomingDueList, { type DueTask } from '@/components/upcoming-due-list'

// ── Typed interfaces for Supabase deep joins ──────────────────────────────

interface StepRow { id: string; status: string }
interface ProjectRow { id: string; name: string; status: string; project_steps: StepRow[] }

interface OverdueRow {
  id: string
  title: string
  due_date: string
  assignee: { full_name: string } | null
  step: { project: { name: string } | null } | null
}

interface WorkloadRow {
  assigned_to: string | null
  status: string
  assignee: { full_name: string } | null
}

interface MyTaskRow {
  id: string
  title: string
  status: string
  due_date: string | null
  step: { project_id: string; project: { name: string } | null } | null
}

interface MyProjectMemberRow {
  project: {
    id: string
    name: string
    status: string
    project_steps: StepRow[]
  } | null
}

// ── Helper ────────────────────────────────────────────────────────────────

function toProjectProgress(p: ProjectRow): ProjectProgressData {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    step_count: p.project_steps.length,
    done_steps: p.project_steps.filter(s => s.status === 'done').length,
    blocked_steps: p.project_steps.filter(s => s.status === 'blocked').length,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', user.id).single()

  const isSA = profile?.role === 'sa'
  const today = new Date().toISOString().split('T')[0]

  // ── SA VIEW ───────────────────────────────────────────────────────────────
  if (isSA) {
    // Query 1: all projects with step statuses
    const { data: projectRows } = await supabase
      .from('projects')
      .select('id, name, status, project_steps(id, status)')
      .order('created_at', { ascending: false })

    const projects: ProjectProgressData[] = (projectRows ?? []).map(p =>
      toProjectProgress(p as unknown as ProjectRow)
    )
    const activeProjectCount = projects.filter(p => p.status === 'active').length

    // Query 2: overdue tasks
    const { data: overdueRows } = await supabase
      .from('tasks')
      .select('id, title, due_date, assignee:profiles!assigned_to(full_name), step:project_steps!project_step_id(project:projects!project_id(name))')
      .lt('due_date', today)
      .neq('status', 'done')
      .order('due_date', { ascending: true })

    const overdueTasks: OverdueTask[] = (overdueRows ?? []).map(t => {
      const row = t as unknown as OverdueRow
      return {
        id: row.id,
        title: row.title,
        due_date: row.due_date,
        assignee_name: row.assignee?.full_name ?? null,
        project_name: row.step?.project?.name ?? '',
      }
    })

    // Query 3: non-done tasks for workload + in_progress count
    const { data: workloadRows } = await supabase
      .from('tasks')
      .select('assigned_to, status, assignee:profiles!assigned_to(full_name)')
      .neq('status', 'done')

    const inProgressCount = (workloadRows ?? []).filter(t => t.status === 'in_progress').length

    const workloadMap = new Map<string, WorkloadEntry>()
    for (const t of workloadRows ?? []) {
      const row = t as unknown as WorkloadRow
      const key = row.assigned_to ?? 'unassigned'
      const name = row.assigned_to
        ? (row.assignee?.full_name ?? 'Unknown')
        : '(Unassigned)'
      if (!workloadMap.has(key)) {
        workloadMap.set(key, { user_id: row.assigned_to, name, todo: 0, in_progress: 0, total: 0 })
      }
      const entry = workloadMap.get(key)!
      if (row.status === 'todo') entry.todo++
      else if (row.status === 'in_progress') entry.in_progress++
      entry.total++
    }
    const workloadEntries: WorkloadEntry[] = Array.from(workloadMap.values())
      .sort((a, b) => b.total - a.total)

    // Query 4: team member count
    const { count: teamCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/projects/new">
            <Button>+ New Project</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Active Projects" value={activeProjectCount} />
          <StatCard label="Tasks In Progress" value={inProgressCount} />
          <StatCard
            label="Overdue Tasks"
            value={overdueTasks.length}
            color={overdueTasks.length > 0 ? 'red' : 'green'}
          />
          <StatCard label="Team Members" value={teamCount ?? 0} />
        </div>

        <OverdueAlert tasks={overdueTasks} />

        <section>
          <h2 className="text-lg font-semibold mb-3">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm">No projects yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <ProjectProgressCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Team Workload</h2>
          <div className="bg-white rounded-lg border p-4">
            <WorkloadList entries={workloadEntries} />
          </div>
        </section>
      </div>
    )
  }

  // ── PM/TL VIEW ────────────────────────────────────────────────────────────

  // Query 1: my tasks (all statuses)
  const { data: myTaskRows } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, step:project_steps!project_step_id(project_id, project:projects!project_id(name))')
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  const myTodo = (myTaskRows ?? []).filter(t => t.status === 'todo').length
  const myInProgress = (myTaskRows ?? []).filter(t => t.status === 'in_progress').length
  const myDone = (myTaskRows ?? []).filter(t => t.status === 'done').length

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  const dueTasks: DueTask[] = (myTaskRows ?? [])
    .filter(t => {
      if (!t.due_date) return false
      if (t.status === 'done') return false
      return t.due_date <= nextWeekStr
    })
    .map(t => {
      const row = t as unknown as MyTaskRow
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        due_date: row.due_date!,
        project_name: row.step?.project?.name ?? '',
        is_overdue: row.due_date! < today,
      }
    })

  // Query 2: my projects with step progress
  const { data: myProjectRows } = await supabase
    .from('project_members')
    .select('project:projects!project_id(id, name, status, project_steps(id, status))')
    .eq('user_id', user.id)

  const myProjects: ProjectProgressData[] = (myProjectRows ?? [])
    .map(r => {
      const row = r as unknown as MyProjectMemberRow
      if (!row.project) return null
      return toProjectProgress(row.project as unknown as ProjectRow)
    })
    .filter((p): p is ProjectProgressData => p !== null)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My Overview</h1>

      <MyTaskSummary todo={myTodo} inProgress={myInProgress} done={myDone} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Upcoming Deadlines</h2>
        <UpcomingDueList tasks={dueTasks} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">My Projects</h2>
        {myProjects.length === 0 ? (
          <p className="text-sm text-gray-500">You haven&apos;t been added to any projects yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myProjects.map(p => (
              <ProjectProgressCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
