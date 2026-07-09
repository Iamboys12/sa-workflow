# Phase 6: My Tasks Page — Design Spec

**Date:** 2026-07-09  
**Status:** Approved

---

## Goal

Upgrade the existing `/my-tasks` page from a read-only list into an interactive task management view. Users can filter by status, update task status inline, and open the TaskDetailModal for comments and activity — all without navigating into individual projects.

---

## Architecture

**Approach:** Hybrid Server + Client Component — consistent with the `task-list.tsx` pattern used in project step pages.

```
my-tasks/page.tsx  (Server Component)
  └── fetches ALL tasks assigned to user.id (no server-side filter)
  └── passes tasks[] as props to <MyTaskList />

src/components/my-task-list.tsx  ('use client')
  ├── Filter tabs: All | Todo | In Progress | Done  (useState — instant, no reload)
  ├── Filtered task rows rendered client-side
  ├── Status chip buttons per row → PATCH /api/tasks/[id] (optimistic update)
  └── TaskDetailModal opened on task title click
```

No new API routes — `PATCH /api/tasks/[id]` already handles status updates.

---

## Data Query

`my-tasks/page.tsx` fetches all tasks for the current user:

```typescript
supabase
  .from('tasks')
  .select(`
    id, title, status, due_date, project_step_id,
    step:project_steps!project_step_id(
      project_id, order,
      project:projects!project_id(name),
      template_step:workflow_template_steps!template_step_id(title)
    )
  `)
  .eq('assigned_to', user.id)
  .order('due_date', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true })
```

This is the same query as the current page — no changes needed to the data shape.

---

## MyTaskList Component

**File:** `src/components/my-task-list.tsx`  
**Directive:** `'use client'`

### Props

```typescript
interface TaskRow {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  due_date: string | null
  project_step_id: string
  project_id: string
  project_name: string
  step_title: string
}

interface MyTaskListProps {
  tasks: TaskRow[]
  currentUserId: string
  isSA: boolean
}
```

The page transforms the raw Supabase rows into `TaskRow[]` before passing them as props (keeps the client component free of join-shape complexity).

### Filter Tabs

Four tabs: **All | Todo | In Progress | Done**

- Active tab: solid background (e.g. `bg-gray-900 text-white`)
- Inactive tab: ghost style
- Switching tabs is instant client-side state — no fetch, no reload
- Empty state per tab: `"No {status} tasks"` (e.g. "No in-progress tasks")
- "All" tab shows global empty state: `"No tasks assigned to you yet."`

### Task Row Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Task title — button, opens TaskDetailModal]                 │
│  Project Name › Step Title          Due 2026-07-15           │
│                              [todo] [in_progress✓] [done]    │
└──────────────────────────────────────────────────────────────┘
```

- **Title**: `<button>` styled as link-text, `onClick` → sets `openTaskId` state → renders `<TaskDetailModal>`
- **Project/Step breadcrumb**: `text-xs text-gray-400`
- **Due date**: `text-xs text-gray-400`; turns `text-red-600 font-medium` when `due_date < today && status !== 'done'`
- **Status chips**: three small badges in a row — current status has filled/highlighted style, others ghost. Clicking a non-current chip calls `handleStatusChange(taskId, newStatus)`

### Status Update (Optimistic)

```typescript
async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
  // 1. Optimistic: update local tasks state immediately
  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  // 2. PATCH /api/tasks/[id]
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  })
  // 3. On error: revert (set error state, restore previous status)
}
```

On PATCH failure: revert the optimistic update and show a brief error message.

### TaskDetailModal Integration

Reuses `src/components/task-detail-modal.tsx` from Phase 4:

```typescript
{openTask && (
  <TaskDetailModal
    taskId={openTask.id}
    taskTitle={openTask.title}
    currentUserId={currentUserId}
    isSA={isSA}
    onClose={() => setOpenTaskId(null)}
  />
)}
```

---

## Page Changes

`src/app/(app)/my-tasks/page.tsx` changes:

1. Keep the same Supabase query
2. Transform rows into `TaskRow[]` (flatten the join shape)
3. Fetch `profile` to get `isSA` and `currentUserId`
4. Replace the current JSX with `<MyTaskList tasks={taskRows} currentUserId={user.id} isSA={isSA} />`

---

## File Map

| File | Action |
|------|--------|
| `src/components/my-task-list.tsx` | Create — client component with filter + status update + modal |
| `src/components/__tests__/my-task-list.test.tsx` | Create |
| `src/app/(app)/my-tasks/page.tsx` | Modify — transform rows, render MyTaskList |

---

## Testing

`src/components/__tests__/my-task-list.test.tsx` — React Testing Library

| Test | What it asserts |
|------|----------------|
| Renders all tasks by default (All tab) | All task titles visible |
| Filter tab "Todo" shows only todo tasks | In-progress/done tasks hidden |
| Filter tab "Done" shows only done tasks | Todo/in-progress tasks hidden |
| Empty state shown when filtered tab has no tasks | "No done tasks" text |
| Status chip click calls PATCH with correct body | `fetch` called with `{ status: 'done' }` |
| Optimistic update: status chip changes immediately | Chip reflects new status before fetch resolves |
| Task title click opens TaskDetailModal | Modal renders with correct taskId |
| Modal close sets openTaskId to null | Modal unmounts |

`global.fetch = jest.fn()` pattern (same as task-detail-modal tests).  
`TaskDetailModal` mocked — test only that it receives correct props, not its internals.

**Test runner:** `npx jest --testPathPatterns=__tests__/my-task-list --no-coverage`

---

## Global Constraints

- No new database tables or migrations
- No new API routes — reuse `PATCH /api/tasks/[id]`
- `my-task-list.tsx` requires `'use client'` (uses `useState`, `fetch`)
- No `any` types — use `TaskRow` interface for all task data
- `TaskDetailModal` is not re-implemented — imported as-is
- Test runner: `npx jest --testPathPatterns=<path> --no-coverage`
