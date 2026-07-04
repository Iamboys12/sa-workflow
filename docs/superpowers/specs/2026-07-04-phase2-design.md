# SA Workflow — Phase 2 Design

**Date:** 2026-07-04  
**Approach:** Sequential Feature Slices (A)  
**Build order:** Project Status → Step Status → Template CRUD → Notifications

---

## Overview

Phase 2 adds four features to complete the SA Workflow Management System. All features build on the existing Next.js 14 + Supabase stack established in Phase 1.

---

## Feature 1: Project Status Management

### UI
- `/projects/[id]` page: add status controls next to the status Badge (SA-only)
- One-way flow: `active → completed → archived`; `archived → active` (reactivate only)
- Dashboard: add tabs/filter for Active / Completed / Archived projects

### API
- `PATCH /api/projects/[id]` — extend existing handler to accept `status` field
- Server-side validation enforces the one-way flow; invalid transitions return 400

### Notification trigger
- None — SA is the only actor who can change project status; no other members need notification

### Tests
- PATCH rejects invalid transitions (e.g. `active → archived` directly)
- PATCH accepts valid transitions (`active → completed`, `completed → archived`, `archived → active`)

---

## Feature 2: Step Status Update

### UI — Workflow Board (StepCard)
- Add `DropdownMenu` (component already exists) at top-right of each StepCard
- Separate click areas: card body navigates to step detail; dropdown corner changes status
- SA sees dropdown; PM/TL sees read-only badge
- Optimistic update via React Query `useMutation`

### UI — Step Detail Page
- Add button group below step title: `[○ Not Started] [◑ In Progress] [⊘ Blocked] [✓ Done]`
- Active status highlighted; only SA can interact

### API
- `PATCH /api/projects/[id]/steps/[stepId]` — new route; accepts `{ status }`, validates enum, updates DB

### Notification trigger
- On step status change: insert notification for every project member except the SA who made the change
- `type: 'step_status_changed'`
- `payload: { project_id, step_id, step_title, old_status, new_status }`

### Tests
- PATCH rejects invalid status enum values
- PATCH rejects non-SA users (403)

---

## Feature 3: Template CRUD UI

### UI — Templates Page (`/settings/templates`)
- Add "New Template" button → opens create Dialog
- Each template card: Edit button (opens edit Dialog), Delete button (confirm dialog before delete)
- Default template: show "default" badge, hide Delete button (API also blocks it)

### Template Dialog
- Fields: template name (text input), step list
- Step management: Add Step button → nested dialog with title, collaboration_model (select), deliverables (comma-separated input → string array)
- Each step in list: edit and delete actions
- Reorder via ↑↓ buttons (no drag-and-drop in Phase 2)

### API
- `POST /api/templates` — create with steps (exists)
- `PATCH /api/templates/[id]` — rename (exists)
- `DELETE /api/templates/[id]` — delete, blocks default (exists)
- `PATCH /api/templates/[id]/steps` — **new**: replace steps for a template (delete-and-reinsert)

### Notification trigger
- None — template management is an admin-only operation

### Tests
- Dialog validation: name required, at least 1 step required
- DELETE still blocks default template

---

## Feature 4: Notifications UI

### UI — Bell Icon (Nav)
- Add bell icon to `nav.tsx` (top-right)
- Unread count badge (red) when unread notifications exist
- Poll every 30 seconds via React Query `refetchInterval` (no Supabase Realtime for simplicity)

### UI — Notification Panel
- Click bell → dropdown panel (not a separate page), shows latest 20 notifications
- Each item: icon per type, human-readable message, relative timestamp (e.g. "3 minutes ago")
- Click item → mark as read + navigate to related resource
- "Mark all as read" button

### Notification types and messages

| type | message |
|---|---|
| `step_status_changed` | "Step [title] changed to [status]" |
| `member_added` | "You were added to project [name]" |
| `task_assigned` | "Task [title] was assigned to you" |
| `task_due_soon` | "Task [title] is due in 1 day" |

### Auto-trigger points

| Event | Where to add trigger |
|---|---|
| `member_added` | `POST /api/members` — after insert |
| `task_assigned` | `POST /api/tasks` and `PATCH /api/tasks/[id]` — when `assigned_to` changes |
| `step_status_changed` | `PATCH /api/projects/[id]/steps/[stepId]` — after update |
| `task_due_soon` | `GET /api/cron/due-soon` — called by external cron (e.g. Vercel Cron) |

### API
- `GET /api/notifications` — fetch latest 20 for current user
- `PATCH /api/notifications/[id]` — mark single notification as read
- `PATCH /api/notifications/read-all` — mark all as read

### Tests
- GET returns only current user's notifications
- PATCH read-all sets `read = true` on all user's notifications

---

## Architecture Notes

- All notification inserts use the Supabase `admin` client (service role) to bypass RLS, inserted server-side inside API route handlers
- No new DB tables or schema changes required — `notifications` table already exists from Phase 1
- `task_due_soon` cron job queries tasks where `due_date = today + 1` and `status != 'done'`, then inserts one notification per task per assignee
- Status transitions are validated server-side only; client UI hides invalid options but does not solely rely on it

---

## File Changes Summary

| File | Change |
|---|---|
| `src/app/api/projects/[id]/route.ts` | extend PATCH to handle status |
| `src/app/(app)/dashboard/page.tsx` | add status filter tabs |
| `src/app/(app)/projects/[id]/page.tsx` | add status controls (SA only) |
| `src/app/api/projects/[id]/steps/[stepId]/route.ts` | new PATCH route |
| `src/components/step-card.tsx` | add status dropdown |
| `src/app/(app)/projects/[id]/steps/[stepId]/page.tsx` | add status button group |
| `src/app/(app)/settings/templates/page.tsx` | add CRUD dialogs |
| `src/app/api/templates/[id]/steps/route.ts` | new PATCH route for step replacement |
| `src/components/nav.tsx` | add bell icon + unread badge |
| `src/components/notification-panel.tsx` | new component |
| `src/app/api/notifications/route.ts` | new GET route |
| `src/app/api/notifications/[id]/route.ts` | new PATCH route |
| `src/app/api/notifications/read-all/route.ts` | new PATCH route |
| `src/app/api/cron/due-soon/route.ts` | new GET route for cron |
| `src/app/api/members/route.ts` | add member_added trigger |
| `src/app/api/tasks/route.ts` | add task_assigned trigger |
| `src/app/api/tasks/[id]/route.ts` | add task_assigned trigger on reassign |
