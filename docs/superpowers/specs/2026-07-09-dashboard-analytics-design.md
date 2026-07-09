# Phase 5: Dashboard & Analytics — Design Spec

**Date:** 2026-07-09  
**Status:** Approved

---

## Goal

Transform the existing `/dashboard` page from a plain project list into a role-aware analytics overview. SA sees cross-project health, overdue alerts, and team workload. PM/TL sees a personal overview: their task summary, their projects' progress, and upcoming deadlines.

No new database tables required — all data comes from existing `projects`, `project_steps`, `tasks`, `project_members`, and `profiles` tables.

---

## Architecture

**Approach:** Pure Server Component. All data is fetched in `dashboard/page.tsx` via Supabase queries and passed as props to presentational child components. No new API routes. No client-side fetching. Consistent with the existing pattern in `my-tasks/page.tsx`.

**Data flow:**
```
DashboardPage (async Server Component)
  ├── fetches all data for the current user's role
  └── renders either <SADashboard> or <PMDashboard>
      each receives plain data props — no Supabase calls inside components
```

---

## Role Detection

```typescript
const isSA = profile?.role === 'sa'
```

- `role === 'sa'` → SA view ("Dashboard")
- `role === 'pm' | 'tech_lead'` → PM/TL view ("My Overview")

---

## SA View

### StatBar
Four stat chips rendered in a horizontal row at the top.

| Label | Value | Color rule |
|-------|-------|------------|
| Active Projects | `projects` WHERE status = 'active' | neutral |
| Tasks In Progress | `tasks` WHERE status = 'in_progress' | neutral |
| Overdue Tasks | `tasks` WHERE due_date < today AND status != 'done' | red if > 0, green if 0 |
| Team Members | distinct count from `profiles` | neutral |

### OverdueAlert
Shown only when overdue count > 0. Lists overdue tasks:
```
⚠ N overdue tasks
• [Task title] — [Project name] — [Assignee] — Due YYYY-MM-DD
```
Collapsed by default if > 5 items (show first 5, "Show N more" toggle).

### Project Health Grid
Replaces the existing project card grid. Each card shows:
- Project name + status badge (existing)
- Progress bar: `done_steps / total_steps` with fraction label (e.g. "6/10 steps done")
- Blocked badge: shown if any step has `status = 'blocked'`
- Clicking still navigates to `/projects/[id]`

### WorkloadList (SA-only)
Table below the project grid:

| Column | Source |
|--------|--------|
| Name | `profiles.full_name` |
| Todo | tasks WHERE status = 'todo' |
| In Progress | tasks WHERE status = 'in_progress' |
| Total | todo + in_progress |
| Bar | relative to max load in team |

- Sorted by Total descending
- Includes an "(Unassigned)" row for tasks with `assigned_to = null`
- Only non-done tasks counted

---

## PM/TL View

Page title: "My Overview"

### MyTaskSummary
Three stat chips (todo / in_progress / done counts) for tasks assigned to the current user. Includes a "View all →" link to `/my-tasks`.

### My Projects
Project cards using `ProjectProgressCard` (same component as SA view), filtered to projects where the user is a `project_members` row. Shows progress bar and blocked badge.

Empty state: "You haven't been added to any projects yet."

### UpcomingDueList
Tasks assigned to the current user with `due_date` between today and today + 7 days (inclusive), sorted by due date ascending:
```
Due YYYY-MM-DD   [Task title]   [status badge]   [Project name]
```
- Overdue tasks (due_date < today, status != done) shown in red above the upcoming list
- Empty state: "No upcoming deadlines 🎉"

---

## Data Queries

### SA queries (3 total)

**1. Projects with step status:**
```typescript
supabase
  .from('projects')
  .select('*, project_steps(id, status)')
  .order('created_at', { ascending: false })
```
Aggregate in code: `step_count`, `done_steps`, `blocked_steps` per project.

**2. Overdue tasks:**
```typescript
supabase
  .from('tasks')
  .select(`
    id, title, due_date,
    assignee:profiles!assigned_to(full_name),
    step:project_steps!project_step_id(
      project:projects!project_id(name)
    )
  `)
  .lt('due_date', today)
  .neq('status', 'done')
  .order('due_date', { ascending: true })
```

**3. Team workload:**
```typescript
supabase
  .from('tasks')
  .select('assigned_to, status, assignee:profiles!assigned_to(full_name)')
  .neq('status', 'done')
```
Aggregate in code: group by `assigned_to`, count todo/in_progress.

### PM/TL queries (2 total)

**1. My tasks (all statuses):**
```typescript
supabase
  .from('tasks')
  .select('id, title, status, due_date, step:project_steps!project_step_id(project_id, project:projects!project_id(name))')
  .eq('assigned_to', user.id)
  .order('due_date', { ascending: true, nullsFirst: false })
```

**2. My projects with step progress:**
```typescript
supabase
  .from('project_members')
  .select('project:projects!project_id(*, project_steps(id, status))')
  .eq('user_id', user.id)
```

---

## File Map

| File | Action |
|------|--------|
| `src/app/(app)/dashboard/page.tsx` | Modify — add queries + role-branched layout |
| `src/components/stat-card.tsx` | Create |
| `src/components/project-progress-card.tsx` | Create |
| `src/components/overdue-alert.tsx` | Create |
| `src/components/workload-list.tsx` | Create |
| `src/components/my-task-summary.tsx` | Create |
| `src/components/upcoming-due-list.tsx` | Create |

`src/components/project-card.tsx` is **not modified** — still used on project detail pages.

---

## Testing

All new components are presentational (props-only), tested with React Testing Library.

| Test file | Key cases |
|-----------|-----------|
| `stat-card.test.tsx` | renders label + value; red variant when color='red' |
| `project-progress-card.test.tsx` | progress % correct; blocked badge shows/hides |
| `overdue-alert.test.tsx` | hidden when empty; shows count; collapse if > 5 |
| `workload-list.test.tsx` | sorted by total desc; unassigned row present |
| `my-task-summary.test.tsx` | correct counts per status; link to /my-tasks |
| `upcoming-due-list.test.tsx` | overdue = red; empty state text; sorted by date |

`dashboard/page.tsx` is not unit-tested directly (Server Component + Supabase). Component tests cover all rendering logic.

---

## Global Constraints

- No new database tables or migrations
- `project-card.tsx` untouched — not in scope
- All new components: no `'use client'` (all presentational, no hooks/state)
- Type safety: no `any` except Supabase deep joins (cast via typed interface)
- Test runner: `npx jest --testPathPatterns=<path>`
