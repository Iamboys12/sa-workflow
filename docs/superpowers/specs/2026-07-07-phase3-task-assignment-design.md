# Phase 3 Design: Task Assignment & Member Workflow

**Date:** 2026-07-07  
**Status:** Approved

## Overview

Extend the SA Workflow Management System so that SA and Tech Lead users can assign tasks to project members with due dates. Assignees can update their own task status. A "My Tasks" page gives every user a flat view of their assigned work. An in-app notification fires one day before a task's due date.

## Scope

- SA and TL can assign tasks to project members and set due dates
- TL can assign in any step (not limited to steps they own)
- Assignees (any role) can update their own task status
- "My Tasks" page: flat list of assigned tasks sorted by due date
- In-app notification 1 day before task due date

## Permission Model

`PATCH /api/tasks/[id]` enforces two tiers:

| Caller | Allowed fields |
|--------|----------------|
| SA (global role) | `title`, `description`, `status`, `assigned_to`, `due_date` |
| TL who is a member of the task's project | same as SA |
| Task's current assignee (any role) | `status` only |
| Everyone else | 403 |

TL membership is verified by joining `tasks → project_steps → project_members` for the current user with `role = 'tech_lead'`.

## API Changes

### 1. `PATCH /api/tasks/[id]` — authorization rework

**Current state:** any authenticated user can patch any field on any task.

**New logic:**
```
auth check (401 if not logged in)
→ fetch task + project_id via: tasks JOIN project_steps ON project_step_id
→ fetch caller's global role from profiles
→ if SA → allow all fields
→ else check project_members (user_id = caller, project_id, role = 'tech_lead')
   → if TL → allow all fields
→ else if task.assigned_to == caller → allow status only
→ else → 403
```

Allowed field list (unchanged): `title`, `description`, `status`, `assigned_to`, `due_date`.

### 2. `GET /api/members?project_id=X` — no changes

Already exists. Returns `project_members` with `profile(id, full_name, role)`. Used by the assignee dropdown in TaskItem.

### 3. `GET /api/my-tasks` — new endpoint

Returns all tasks assigned to the authenticated user, with enough context for the My Tasks page.

Query (Supabase):
```
tasks
  JOIN project_steps ON tasks.project_step_id = project_steps.id
  JOIN projects ON project_steps.project_id = projects.id
  LEFT JOIN workflow_template_steps ON project_steps.template_step_id = workflow_template_steps.id
WHERE tasks.assigned_to = auth.uid()
ORDER BY due_date ASC NULLS LAST, created_at ASC
```

Response shape per task:
```typescript
{
  id: string
  title: string
  status: TaskStatus
  due_date: string | null
  project_step_id: string
  project_id: string
  project_name: string
  step_title: string      // from workflow_template_steps.title or "Step N" fallback
  step_order: number
}
```

## UI Changes

### `TaskItem` — props extended

New props added:
- `projectId: string` — used to fetch member list for assignee dropdown
- `canAssign: boolean` — true if current user is SA or TL in this project
- `currentUserId: string` — used to determine if user is the assignee

**Assignee select** (visible when `canAssign`):
- Fetches `/api/members?project_id={projectId}` on mount
- `<Select>` showing `profile.full_name` for each member
- On change: calls `onUpdate(task.id, { assigned_to: memberId })`
- Shows current assignee name when set; "Unassigned" when null

**Due date input** (visible when `canAssign`):
- `<input type="date">` inline in the task row
- On change: calls `onUpdate(task.id, { due_date: value })`
- Existing "Due …" text display remains for non-assigners

**Status toggle** — condition changed from `isSA` to `isSA || task.assigned_to === currentUserId`. Assignees see the checkbox to cycle their task status (todo → in_progress → done).

### `TaskList` — props extended

New props:
- `projectId: string`
- `canAssign: boolean`
- `currentUserId: string`

All three are passed down to each `TaskItem`. The step detail page (server component) determines `canAssign` from `profiles.role` and `project_members`.

### Step Detail Page (`/projects/[id]/steps/[stepId]`)

Already fetches `profiles.role`. Add:
- Fetch `project_members` row for current user to determine TL status
- Compute `canAssign = isSA || isTLInProject`
- Pass `projectId`, `canAssign`, `currentUserId` to `<TaskList>`

### My Tasks Page (`/my-tasks`)

New server component at `src/app/(app)/my-tasks/page.tsx`.

- Fetches `GET /api/my-tasks`
- Renders a flat list grouped by nothing (sorted by due date)
- Each row:
  - Task title (links to `/projects/{project_id}/steps/{project_step_id}`)
  - Status badge (existing `statusStyle` colors)
  - Due date — red text if `due_date < today`, normal gray otherwise
  - Breadcrumb: `{project_name} › {step_title}`

Empty state: "No tasks assigned to you yet."

### Nav (`nav.tsx`)

Add "My Tasks" link for all authenticated users (beside existing nav items).

## DB Migration

### `supabase/migrations/20260707000001_due_date_cron.sql`

Schedules a pg_cron job to notify assignees one day before task due date:

```sql
SELECT cron.schedule(
  'due-date-reminder',
  '0 8 * * *',
  $$
  INSERT INTO notifications (user_id, type, payload)
  SELECT
    t.assigned_to,
    'task_due_soon',
    jsonb_build_object(
      'task_id',    t.id,
      'task_title', t.title,
      'due_date',   t.due_date
    )
  FROM tasks t
  WHERE t.due_date = (now() AT TIME ZONE 'UTC')::date + 1
    AND t.assigned_to IS NOT NULL
    AND t.status != 'done'
  $$
);
```

Runs daily at 08:00 UTC. The existing `NotificationBell` already renders `task_due_soon` notifications generically via payload display — no frontend changes needed.

## Testing

Each task follows the existing SDD pattern (implementer → reviewer → fixer).

| Task | Test coverage |
|------|---------------|
| PATCH /api/tasks/[id] auth | Jest: SA allows all, TL allows all, assignee status-only, stranger 403 |
| GET /api/my-tasks | Jest: returns only caller's tasks, sorted correctly |
| TaskItem assignee/due-date UI | React Testing Library: select renders when canAssign, hidden otherwise |
| My Tasks page | React Testing Library: renders task list, shows overdue highlight |

## Deliverables

1. `supabase/migrations/20260707000001_due_date_cron.sql`
2. `src/app/api/tasks/[id]/route.ts` — PATCH auth rework
3. `src/app/api/my-tasks/route.ts` — new GET endpoint
4. `src/components/task-item.tsx` — assignee select + due date input + assignee status toggle
5. `src/components/task-list.tsx` — new props
6. `src/app/(app)/projects/[id]/steps/[stepId]/page.tsx` — pass canAssign props
7. `src/app/(app)/my-tasks/page.tsx` — new page
8. `src/components/nav.tsx` — My Tasks link
