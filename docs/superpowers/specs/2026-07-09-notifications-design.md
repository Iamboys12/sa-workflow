# Phase 7: Notifications Design

## Overview

Complete the in-app notification system. The UI (`NotificationBell`), nav wiring, and API routes are already fully implemented. This phase adds the missing pieces: Supabase Realtime enablement on the `notifications` table, a `comment_added` DB trigger, a `formatMessage` handler for the new type, and full test coverage.

## What Already Exists (Do Not Rebuild)

- `src/components/notification-bell.tsx` — fully implemented (Realtime subscription, dropdown, mark read, navigate to project)
- `src/components/nav.tsx` — `NotificationBell` already wired in
- `src/app/api/notifications/route.ts` — `GET` (fetch 20 most recent) + `PATCH` (mark all read)
- `src/app/api/notifications/[id]/route.ts` — `PATCH` (mark single notification read)
- `notifications` table + RLS in initial schema migration
- `notify_task_assigned` trigger (fires on `tasks` UPDATE when `assigned_to` changes)
- `notify_step_status_changed` trigger (fires on `project_steps` UPDATE when `status` changes)

## Database Migrations

### Migration 1: Realtime enablement

File: `supabase/migrations/20260709000001_notifications_realtime.sql`

```sql
alter table notifications replica identity full;
alter publication supabase_realtime add table notifications;
```

Required for the Supabase Realtime subscription in `NotificationBell` to receive live INSERT events.

### Migration 2: comment_added trigger

File: `supabase/migrations/20260709000002_comment_notification.sql`

Fires on INSERT to `task_events` where `event_type = 'comment'`.

Recipients: task assignee + all project members, excluding the commenter. Both sets are unioned and deduplicated — if the assignee is also a project member they receive exactly one notification.

Payload shape:
```json
{
  "task_id": "<uuid>",
  "task_title": "<string>",
  "project_id": "<uuid>",
  "commenter_name": "<string>"
}
```

Notification type: `comment_added`.

## Component Update

File: `src/components/notification-bell.tsx`

Add one branch to `formatMessage()`:

```typescript
if (n.type === 'comment_added')
  return `${p.commenter_name} commented on "${p.task_title}"`
```

Existing navigation logic (`router.push(`/projects/${p.project_id}`)`) already handles this type correctly.

## Tests

### NotificationBell component

File: `src/components/__tests__/notification-bell.test.tsx`

Mocks:
- `next/navigation` → `useRouter` returns `{ push: jest.fn() }`
- `@/lib/supabase/client` → `createBrowserSupabase` returns fake channel with chainable `.on().subscribe()` and `.removeChannel()` stubs
- `global.fetch` → `jest.fn()` (same pattern as `my-task-list.test.tsx`)

Test cases:
1. Renders bell button
2. Shows unread badge with count when unread notifications exist
3. Caps badge at "9+" when unread count > 9
4. Shows "No notifications" when list is empty
5. Renders notification message using `formatMessage` for `task_assigned`
6. Renders notification message for `comment_added`
7. Calls `PATCH /api/notifications` when "Mark all as read" is clicked
8. Calls `PATCH /api/notifications/[id]` and navigates to project when an unread item is clicked
9. Does not call PATCH when an already-read item is clicked (still navigates)

### API routes

File: `src/app/api/notifications/__tests__/route.test.ts`

Mocks: `@/lib/supabase/server` → `createServerSupabase` returns a fake client with chainable query methods.

Test cases:
1. `GET` — returns notification array for authenticated user
2. `GET` — returns 401 when no authenticated user
3. `PATCH` — marks all notifications read, returns `{ success: true }`
4. `PATCH` — returns 401 when no authenticated user

File: `src/app/api/notifications/__tests__/[id]/route.test.ts`

Test cases:
1. `PATCH` — marks single notification read by id + user_id, returns `{ success: true }`
2. `PATCH` — returns 401 when no authenticated user

## Architecture Summary

```
task_events INSERT (event_type='comment')
  → notify_comment_added() trigger
    → notifications INSERT (type='comment_added', one per recipient)
      → Supabase Realtime (replica identity full + publication)
        → NotificationBell fetchAll()
          → dropdown updates live
```

## Task Breakdown

1. **Realtime migration** — `20260709000001_notifications_realtime.sql`
2. **comment_added trigger** — `20260709000002_comment_notification.sql`
3. **formatMessage update** — add `comment_added` branch in `notification-bell.tsx`
4. **NotificationBell tests** — `src/components/__tests__/notification-bell.test.tsx`
5. **API route tests** — `src/app/api/notifications/__tests__/route.test.ts` + `[id]/route.test.ts`
