# SA Workflow — Phase 2 Design

**Date:** 2026-07-05  
**Stack:** Next.js 14 + Supabase  
**Approach:** Extend Phase 1 patterns (API routes + React Query mutations + Supabase Realtime for notifications)

---

## Overview

Phase 2 adds four features on top of the completed Phase 1 codebase:

1. **Template CRUD** — SA users can create, edit, and delete custom workflow templates with inline step management
2. **Notifications UI** — Bell icon in nav with real-time dropdown; triggers on task assignment and step status change
3. **Project status management** — SA who created a project can transition its status from the dashboard
4. **Step status update** — SA can update step status from both the workflow board card and the step detail page

---

## Feature 1: Template CRUD

### What exists
- `GET /api/templates` — list templates ✓
- `POST /api/templates` — create template with steps ✓
- `DELETE /api/templates/[id]` — refuses default template ✓
- `PATCH /api/templates/[id]` — updates name only (needs extending)

### API changes
**`PATCH /api/templates/[id]`** — extend to accept `name` + `steps[]`. When steps are provided, delete all existing steps for the template and insert the new set. SA role required; default templates cannot be edited.

### New files
| File | Purpose |
|------|---------|
| `src/components/template-form.tsx` | Shared form: template name input + dynamic step list (add/remove steps inline). Step fields: title (text), collaboration_model (select: human-led / ai-assisted / paired), deliverables (add/remove individual items). |
| `src/app/(app)/settings/templates/new/page.tsx` | Create page — renders `<TemplateForm>` with empty initial state |
| `src/app/(app)/settings/templates/[id]/edit/page.tsx` | Edit page — fetches template + steps server-side, renders `<TemplateForm>` prefilled |

### Changes to existing files
**`settings/templates/page.tsx`** — add "New Template" button (links to `/settings/templates/new`). Each template card gains Edit button (links to `/settings/templates/[id]/edit`) and Delete button (calls `DELETE /api/templates/[id]` with confirmation). Default template hides both Edit and Delete buttons.

### Constraints
- Only SA role can access create/edit/delete actions (enforced at API and redirected at page level)
- Default template (`is_default = true`) is read-only — no edit or delete

---

## Feature 2: Notifications

### New API routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/notifications` | GET | List current user's notifications, ordered by `created_at DESC`, limit 20 |
| `/api/notifications` | PATCH | Mark all notifications as read (`read = true`) for current user |
| `/api/notifications/[id]` | PATCH | Mark a single notification as read |

### New UI components
**`src/components/notification-bell.tsx`** — client component placed in `nav.tsx` beside the user's name.
- Subscribes to Supabase Realtime on the `notifications` table filtered by `user_id = current user` — updates unread count badge in real time
- Bell icon shows a blue badge with unread count (hidden when count is 0)
- Clicking the bell opens a dropdown (uses existing `dropdown-menu` UI component)
- Dropdown header: "Notifications" label + "Mark all as read" button
- Dropdown body: list of up to 20 notifications — each item shows a message derived from `type` + `payload`, relative timestamp, and a blue dot if unread
- Clicking an item: marks as read + navigates to the relevant project (`payload.project_id`)

### Notification message format
| type | Message |
|------|---------|
| `task_assigned` | "You were assigned to «task_title»" |
| `step_status_changed` | "Step «step_title» is now «new_status»" |

### DB triggers (new migration)
**Migration file:** `supabase/migrations/20260705000001_notification_triggers.sql`

| Event | Trigger | Recipient | payload fields |
|-------|---------|-----------|----------------|
| `tasks.assigned_to` changes to a non-null value | `AFTER UPDATE ON tasks` | `NEW.assigned_to` | `{ task_id, task_title, project_id, step_id }` |
| `project_steps.status` changes | `AFTER UPDATE ON project_steps` | All project members except the updater | `{ step_id, step_title, project_id, new_status }` |

`step_title` is resolved inside the trigger by looking up `workflow_template_steps.title` via `NEW.template_step_id` (falls back to `'Step ' || NEW.order` if null).

Both triggers insert rows into the `notifications` table using `security definer` functions.

---

## Feature 3: Project Status Management

### New API route
**`PATCH /api/projects/[id]`** — accepts `{ status: 'active' | 'completed' | 'archived' }`. Only the SA who created the project (`created_by = auth.uid()`) can update status.

### Status transitions
| Current status | Allowed transitions |
|----------------|---------------------|
| active | → completed, → archived |
| completed | → active (restore), → archived |
| archived | → active (restore) |

### UI changes
**`src/components/project-card-actions.tsx`** — new client component. Renders a 3-dot icon button in the top-right corner of the project card. Opens a dropdown with status transition actions based on current status. On selection: calls `PATCH /api/projects/[id]`, then invalidates the projects React Query cache (or triggers router refresh). Uses `stopPropagation` so the card's link navigation is not triggered.

**`src/components/project-card.tsx`** — accepts two new props: `isSA: boolean` and `userId: string`. Renders `<ProjectCardActions>` inside the card when `isSA && project.created_by === userId`.

**`src/app/(app)/dashboard/page.tsx`** — pass `profile.id` and `isSA` flag down to each `<ProjectCard>`.

---

## Feature 4: Step Status Update

### New API route
**`PATCH /api/projects/[id]/steps/[stepId]`** — accepts `{ status: StepStatus }`. SA role required. On success, the step status update triggers the `step_status_changed` notification (via DB trigger defined in Feature 2).

### UI — Point 1: StepCard dropdown (workflow board)

**`src/components/step-card.tsx`** — gains two new props: `isSA: boolean` and `onStatusChange: (status: StepStatus) => void`. When `isSA`:
- Renders a 3-dot icon button overlaid in the top-right corner
- Opening the menu stops click propagation (prevents navigation)
- Four menu items: Not Started / In Progress / Blocked / Done — current status is shown with a checkmark
- Selecting an item calls `onStatusChange` → parent issues `PATCH` + invalidates React Query cache

**`src/components/workflow-board.tsx`** — receives `isSA: boolean` as a prop (passed down from the server page, which already has the profile). Passes `isSA` and a `handleStepStatusChange` mutation down to each `<StepCard>`.

**`src/app/(app)/projects/[id]/page.tsx`** — already fetches `profile.role`; derives `isSA` and passes it to `<WorkflowBoard>`.

### UI — Point 2: Step detail page

**`src/components/step-status-select.tsx`** — new client component. Renders a select with four options, each with a color indicator matching Phase 1's status colors (gray / blue / red / green). On change: calls `PATCH /api/projects/[id]/steps/[stepId]`, shows toast on success/error.

**`src/app/(app)/projects/[id]/steps/[stepId]/page.tsx`** — renders `<StepStatusSelect>` beside the step title when `isSA`. Passes `projectId`, `stepId`, and current `status` as props.

---

## Types

Add `Notification` type already exists in `src/lib/types.ts`. No new types needed.

---

## Testing

Follow Phase 1 patterns — unit/integration tests for new API routes:
- `src/app/api/notifications/__tests__/route.test.ts`
- `src/app/api/projects/[id]/__tests__/route.test.ts`
- `src/app/api/projects/[id]/steps/[stepId]/__tests__/route.test.ts`

Component tests for `StepCard` (already has `__tests__/step-card.test.tsx`) — extend to cover dropdown behavior.
