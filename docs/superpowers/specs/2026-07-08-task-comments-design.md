# Phase 4 Design: Task Comments & Activity Feed

**Date:** 2026-07-08
**Status:** Approved

## Overview

Add a comment thread and activity log to each task. Users open a modal by clicking a task title; the modal shows a unified timeline of user-written comments and auto-generated activity events (status changes, assignments, due-date changes), updated in real-time via Supabase Realtime.

## Decisions

| Question | Decision |
|----------|----------|
| Where do comments appear? | Modal/Dialog (click task title) |
| Who can comment? | Project members + SA (global) |
| Edit/delete? | Delete only — author or SA; activity events cannot be deleted |
| Activity log? | Yes — unified timeline with comments |
| Real-time? | Yes — Supabase Realtime subscription |
| Schema approach? | Single `task_events` table (unified) |

## Scope

- `task_events` table stores both comments and activity events
- Modal opens on task title click; shows timeline + comment input
- Real-time updates while modal is open
- Activity events auto-inserted by `PATCH /api/tasks/[id]` on field changes
- Delete own comment (or any comment for SA)
- No editing of comments

## Data Model

### New table: `task_events`

```sql
create table task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete restrict,
  type       text not null,
  body       text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
```

**`type` values:**

| type | body | meta |
|------|------|------|
| `comment` | user's message | null |
| `status_change` | null | `{ from: TaskStatus, to: TaskStatus }` |
| `assigned` | null | `{ from_user_id: string\|null, to_user_id: string\|null }` |
| `due_date_set` | null | `{ from: string\|null, to: string\|null }` |

**RLS:**
- `SELECT` — project members of the task's project, or SA (same helper as other tables)
- `INSERT` — project members or SA (server routes use the caller's JWT, so RLS must permit it; activity events written by PATCH route also use caller's JWT)
- `DELETE` — `user_id = auth.uid()` AND `type = 'comment'`, OR SA (any comment, type='comment' only)

**Migration file:** `supabase/migrations/20260708000002_task_events.sql`

**Index:** `create index on task_events(task_id, created_at);`

## API

### New endpoints

#### `GET /api/tasks/[id]/events`

- Auth check → 401
- Verify caller is project member or SA → 403
- Returns `task_events` for the task joined with `profiles(full_name)`, sorted `created_at ASC`
- For `assigned` events, resolve `meta.from_user_id` and `meta.to_user_id` to names by fetching profiles in the route and attaching `from_user_name` / `to_user_name` to each event before returning
- Response shape:
  ```typescript
  {
    id: string
    task_id: string
    user_id: string
    user_name: string         // author of the event
    type: string
    body: string | null
    meta: Record<string, unknown> | null  // assigned: includes from_user_name, to_user_name
    created_at: string
  }[]
  ```

#### `POST /api/tasks/[id]/events`

- Auth check → 401
- Verify caller is project member or SA → 403
- Body: `{ body: string }` — 400 if missing or empty
- Inserts row with `type='comment'`
- Returns created event → 201

#### `DELETE /api/tasks/[id]/events/[eventId]`

- Auth check → 401
- Fetch event → 404 if not found
- Reject if `type !== 'comment'` → 403
- Reject if caller is not owner and not SA → 403
- Deletes row → 200

### Modified endpoint

#### `PATCH /api/tasks/[id]` — activity insertion

After a successful update, insert `task_events` rows for each changed field:

| Field changed | type | meta |
|---------------|------|------|
| `status` | `status_change` | `{ from: oldStatus, to: newStatus }` |
| `assigned_to` | `assigned` | `{ from_user_id: old, to_user_id: new }` |
| `due_date` | `due_date_set` | `{ from: old, to: new }` |

Activity events are inserted with the caller's `user_id`. Only insert an event if the value actually changed (compare old task row with updates).

## UI

### Files

| File | Action |
|------|--------|
| `supabase/migrations/20260708000002_task_events.sql` | Create |
| `src/app/api/tasks/[id]/events/route.ts` | Create |
| `src/app/api/tasks/[id]/events/[eventId]/route.ts` | Create |
| `src/app/api/tasks/[id]/events/__tests__/route.test.ts` | Create |
| `src/app/api/tasks/[id]/route.ts` | Modify — insert activity events on field change |
| `src/components/task-detail-modal.tsx` | Create |
| `src/components/task-list.tsx` | Modify — manage open modal state, pass onOpenDetail |
| `src/components/task-item.tsx` | Modify — make title clickable |
| `src/lib/types.ts` | Modify — add `TaskEvent` type |

### `TaskItem` change

Title `<p>` becomes a `<button>` that calls `onOpenDetail(task.id)`. `TaskList` passes `onOpenDetail` down; `TaskList` manages which task's modal is open (one at a time).

### `TaskDetailModal`

```
Props: { taskId: string, taskTitle: string, currentUserId: string, isSA: boolean, onClose: () => void }
```

**Structure:**
```
┌─────────────────────────────────────┐
│ [Task title]              [×] close │
│ (status badge shown in timeline)    │
├─────────────────────────────────────┤
│ Timeline (scrollable, flex-col)     │
│                                     │
│  👤 Somchai — 10:32                 │
│  Status changed: todo → in_progress │
│                                     │
│  💬 Malee — 10:45                   │
│  "ทำเสร็จแล้ว รอ review นะครับ"    │
│     [ลบ]  ← owner or SA only       │
│                                     │
├─────────────────────────────────────┤
│ [_____ พิมพ์ comment... _______] [ส่ง] │
└─────────────────────────────────────┘
```

**State:** `events: TaskEvent[]`, `newComment: string`, `submitting: boolean`

**On mount:**
1. `GET /api/tasks/[id]/events` → populate `events`
2. Subscribe `supabase.channel('task_events:[taskId]').on('postgres_changes', { event: '*', schema: 'public', table: 'task_events', filter: 'task_id=eq.[taskId]' }, handler)`

**On new realtime event:** append to `events` state (INSERT) or remove (DELETE)

**On unmount:** unsubscribe channel

**Submit comment:** POST → optimistic append not needed (realtime will deliver it)

**Delete comment:** DELETE → realtime removes from state

**Activity event display:**
- `status_change`: "Status changed: {from} → {to}"
- `assigned`: "Assigned to {name}" or "Unassigned"
- `due_date_set`: "Due date set to {date}" or "Due date removed"
- `comment`: show `body` text

## Testing

### API — Jest (node environment)

**`src/app/api/tasks/[id]/events/__tests__/route.test.ts`**

| Case | Expectation |
|------|-------------|
| GET — not authenticated | 401 |
| GET — not a project member | 403 |
| GET — project member | 200 with events array |
| POST — not authenticated | 401 |
| POST — not a project member | 403 |
| POST — empty body | 400 |
| POST — valid comment | 201 |
| DELETE — not authenticated | 401 |
| DELETE — event not found | 404 |
| DELETE — not owner, not SA | 403 |
| DELETE — type is not comment | 403 |
| DELETE — owner deletes own comment | 200 |
| DELETE — SA deletes any comment | 200 |

**`src/app/api/tasks/[id]/__tests__/route.test.ts`** — add cases:
- PATCH with status change → activity event inserted
- PATCH with assigned_to change → activity event inserted
- PATCH with no field change → no activity event inserted

### Component — React Testing Library

**`src/components/__tests__/task-detail-modal.test.tsx`**

| Case | Expectation |
|------|-------------|
| Renders comment body | visible |
| Renders activity event text | visible |
| Delete button hidden for other user's comment | not in DOM |
| Delete button visible for own comment | in DOM |
| Delete button visible for SA on any comment | in DOM |

Realtime subscription is not tested (mock at the module level).

## Global Constraints (carry forward)

- Test runner: `npx jest --testPathPatterns=<path>`
- All API routes: auth check before any DB query
- ESLint: no unused imports
- No `any` types except Supabase deep joins (cast via typed interface)
- Supabase join syntax: `table!fk_column(fields)`
- Client components: `'use client'` at top
