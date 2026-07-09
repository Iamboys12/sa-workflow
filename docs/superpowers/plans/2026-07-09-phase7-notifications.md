# Phase 7: Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the notification system by enabling Supabase Realtime on the notifications table, adding a `comment_added` DB trigger, a `formatMessage` handler for the new type, and full test coverage.

**Architecture:** Two SQL migrations enable live notifications and the comment_added event. One line added to `formatMessage()` in the existing `NotificationBell` component. Tests cover the component, the existing route (add 401 cases), and the new `[id]` route.

**Tech Stack:** PostgreSQL triggers (plpgsql), Next.js 14 App Router API routes, React Testing Library + Jest 30, Supabase Realtime.

## Global Constraints

- Test runner: `npx jest --testPathPatterns=<path> --no-coverage` (plural flag, no coverage flag)
- All API route test files must have `/** @jest-environment node */` at the top
- Mock fetch with `global.fetch = jest.fn()` (NOT `jest.spyOn`) + `jest.clearAllMocks()` in `afterEach`
- No `any` types except where Supabase deep joins require casting
- No `'use client'` changes — `notification-bell.tsx` is already a client component
- DB trigger function: `security definer set search_path = public`, language `plpgsql`
- Supabase join syntax: `table!fk_column(fields)` — not used in this phase but keep in mind for context
- `notification-bell.tsx` already imports `Notification` from `@/lib/types` — do not change imports

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260709000001_notifications_realtime.sql` |
| Create | `supabase/migrations/20260709000002_comment_notification.sql` |
| Modify | `src/components/notification-bell.tsx` (add one branch to `formatMessage`, lines 16-21) |
| Create | `src/components/__tests__/notification-bell.test.tsx` |
| Modify | `src/app/api/notifications/__tests__/route.test.ts` (add `mockGetUser` + 401 tests) |
| Create | `src/app/api/notifications/[id]/__tests__/route.test.ts` |

---

## What Already Exists — Do Not Rebuild

- `src/components/notification-bell.tsx` — full UI: Realtime subscription, dropdown, mark read, navigate
- `src/components/nav.tsx` — already imports and renders `NotificationBell`
- `src/app/api/notifications/route.ts` — `GET` + `PATCH` (mark all read)
- `src/app/api/notifications/[id]/route.ts` — `PATCH` (mark single read)
- `notifications` table + RLS in `20260703000000_initial_schema.sql`
- `notify_task_assigned` and `notify_step_status_changed` triggers in `20260705000001_notification_triggers.sql`
- `src/app/api/notifications/__tests__/route.test.ts` — has GET + PATCH happy-path tests; needs 401 cases added

---

### Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260709000001_notifications_realtime.sql`
- Create: `supabase/migrations/20260709000002_comment_notification.sql`

**Interfaces:**
- Produces: `notifications` table with Realtime enabled; trigger function `notify_comment_added()` fires on `task_events` INSERT where `type = 'comment'`; notification payload shape `{ task_id, task_title, project_id, commenter_name }` consumed by Task 2

**Key schema facts (do not guess, use these exact column names):**
- `task_events`: columns `id`, `task_id` (→ tasks), `user_id` (→ profiles, the commenter), `type` (text: `'comment'`|`'status_change'`|...), `body`, `meta`, `created_at`
- `tasks`: columns include `title`, `assigned_to` (uuid|null), `project_step_id`
- `project_steps`: columns include `id`, `project_id`
- `project_members`: columns `project_id`, `user_id`
- `profiles`: columns `id`, `full_name`
- `notifications`: columns `id`, `user_id`, `type`, `payload` (jsonb), `read`, `created_at`

- [ ] **Step 1: Create the Realtime migration**

Create `supabase/migrations/20260709000001_notifications_realtime.sql` with this exact content:

```sql
alter table notifications replica identity full;
alter publication supabase_realtime add table notifications;
```

- [ ] **Step 2: Create the comment_added trigger migration**

Create `supabase/migrations/20260709000002_comment_notification.sql` with this exact content:

```sql
create or replace function notify_comment_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_task_title     text;
  v_assigned_to    uuid;
  v_project_id     uuid;
  v_commenter_name text;
  v_payload        jsonb;
  v_recipient      uuid;
begin
  if new.type <> 'comment' then
    return new;
  end if;

  select t.title, t.assigned_to, ps.project_id
    into v_task_title, v_assigned_to, v_project_id
    from tasks t
    join project_steps ps on ps.id = t.project_step_id
   where t.id = new.task_id;

  select coalesce(full_name, 'Someone')
    into v_commenter_name
    from profiles
   where id = new.user_id;

  v_payload := jsonb_build_object(
    'task_id',        new.task_id,
    'task_title',     v_task_title,
    'project_id',     v_project_id,
    'commenter_name', v_commenter_name
  );

  for v_recipient in
    select distinct user_id
      from (
        select v_assigned_to as user_id
        union
        select pm.user_id
          from project_members pm
         where pm.project_id = v_project_id
      ) r
     where user_id is not null
       and user_id is distinct from new.user_id
  loop
    insert into notifications (user_id, type, payload)
    values (v_recipient, 'comment_added', v_payload);
  end loop;

  return new;
end;
$$;

create trigger on_comment_added
  after insert on task_events
  for each row execute function notify_comment_added();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260709000001_notifications_realtime.sql
git add supabase/migrations/20260709000002_comment_notification.sql
git commit -m "feat: enable notifications realtime and add comment_added trigger"
```

---

### Task 2: formatMessage update + NotificationBell tests

**Files:**
- Modify: `src/components/notification-bell.tsx`
- Create: `src/components/__tests__/notification-bell.test.tsx`

**Interfaces:**
- Consumes: payload shape `{ task_id, task_title, project_id, commenter_name }` from Task 1
- Produces: `formatMessage` handles `'comment_added'` → `"Alice commented on \"Review PR\""`

**Context:** `notification-bell.tsx` has `formatMessage` at lines 16–21:
```typescript
function formatMessage(n: Notification): string {
  const p = n.payload as Record<string, string>
  if (n.type === 'task_assigned') return `You were assigned to "${p.task_title}"`
  if (n.type === 'step_status_changed') return `Step "${p.step_title}" is now ${p.new_status}`
  return n.type
}
```

The component uses these shadcn imports (mock them in tests to avoid portal/radix issues):
- `@/components/ui/dropdown-menu`: `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
- `@/components/ui/button`: `Button`

The Supabase channel chain the component uses:
```typescript
supabase.channel(`notifications:${userId}`).on('postgres_changes', {...}, cb).subscribe()
```
`removeChannel(channel)` is called on cleanup. Mock these in tests.

- [ ] **Step 1: Add comment_added branch to formatMessage**

In `src/components/notification-bell.tsx`, replace the `formatMessage` function:

```typescript
function formatMessage(n: Notification): string {
  const p = n.payload as Record<string, string>
  if (n.type === 'task_assigned') return `You were assigned to "${p.task_title}"`
  if (n.type === 'step_status_changed') return `Step "${p.step_title}" is now ${p.new_status}`
  if (n.type === 'comment_added') return `${p.commenter_name} commented on "${p.task_title}"`
  return n.type
}
```

- [ ] **Step 2: Create the test file**

Create `src/components/__tests__/notification-bell.test.tsx` with this complete content:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationBell from '../notification-bell'
import type { Notification } from '@/lib/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockRemoveChannel = jest.fn()
const mockSubscribe = jest.fn()
const mockOn = jest.fn()
const mockChannel = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabase: () => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

const unread: Notification = {
  id: 'n1',
  user_id: 'u1',
  type: 'task_assigned',
  payload: { task_id: 't1', task_title: 'Fix bug', project_id: 'p1', step_id: 's1' },
  read: false,
  created_at: new Date().toISOString(),
}

const readComment: Notification = {
  id: 'n2',
  user_id: 'u1',
  type: 'comment_added',
  payload: { task_id: 't2', task_title: 'Review PR', project_id: 'p2', commenter_name: 'Alice' },
  read: true,
  created_at: new Date().toISOString(),
}

beforeEach(() => {
  mockOn.mockReturnValue({ subscribe: mockSubscribe })
  mockChannel.mockReturnValue({ on: mockOn })
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([unread, readComment]),
  } as Response)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('NotificationBell', () => {
  it('renders the bell button', () => {
    render(<NotificationBell userId="u1" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows unread badge count after notifications load', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('caps badge at 9+ when more than 9 notifications are unread', async () => {
    const many: Notification[] = Array.from({ length: 10 }, (_, i) => ({
      ...unread,
      id: `n${i}`,
    }))
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(many),
    } as Response)
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument()
    })
  })

  it('renders task_assigned message correctly', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('You were assigned to "Fix bug"')).toBeInTheDocument()
    })
  })

  it('renders comment_added message correctly', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('Alice commented on "Review PR"')).toBeInTheDocument()
    })
  })

  it('calls PATCH /api/notifications when mark all as read is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('Mark all as read'))
    fireEvent.click(screen.getByText('Mark all as read'))
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications', { method: 'PATCH' })
  })

  it('calls PATCH /api/notifications/[id] and navigates when an unread item is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('You were assigned to "Fix bug"'))
    fireEvent.click(screen.getByText('You were assigned to "Fix bug"'))
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications/n1', { method: 'PATCH' })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/p1')
    })
  })

  it('does not call PATCH but still navigates when a read item is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('Alice commented on "Review PR"'))
    fireEvent.click(screen.getByText('Alice commented on "Review PR"'))
    const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, opts]: [string, RequestInit]) =>
        url === '/api/notifications/n2' && opts?.method === 'PATCH'
    )
    expect(patchCalls).toHaveLength(0)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/p2')
    })
  })
})
```

- [ ] **Step 3: Run the tests**

```bash
npx jest --testPathPatterns=src/components/__tests__/notification-bell --no-coverage
```

Expected: 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/notification-bell.tsx
git add src/components/__tests__/notification-bell.test.tsx
git commit -m "feat: add comment_added notification format and NotificationBell tests"
```

---

### Task 3: API route tests

**Files:**
- Modify: `src/app/api/notifications/__tests__/route.test.ts`
- Create: `src/app/api/notifications/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `GET /api/notifications`, `PATCH /api/notifications` from existing `route.ts`; `PATCH /api/notifications/[id]` from existing `[id]/route.ts`

**Context — existing route.test.ts** (path: `src/app/api/notifications/__tests__/route.test.ts`):
The current file uses a hardcoded `getUser` mock that always returns a user. You must refactor it to use a separate `mockGetUser` function so 401 tests can override it. The existing happy-path tests must continue to pass.

**Context — [id]/route.ts** chain:
```typescript
await supabase.from('notifications').update({ read: true }).eq('id', params.id).eq('user_id', user.id)
```
The mock needs two chained `.eq()` calls.

- [ ] **Step 1: Rewrite route.test.ts to add mockGetUser and 401 tests**

Replace the entire content of `src/app/api/notifications/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const sampleNotifications = [
  {
    id: 'n1',
    user_id: 'u1',
    type: 'task_assigned',
    payload: { task_title: 'T1', project_id: 'p1', task_id: 'tk1', step_id: 's1' },
    read: false,
    created_at: '2026-07-06T00:00:00Z',
  },
]

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/notifications', () => {
  it('returns notifications for current user', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: jest.fn().mockResolvedValue({ data: sampleNotifications, error: null }),
          }),
        }),
      }),
    }))
    const req = new NextRequest('http://localhost/api/notifications')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].type).toBe('task_assigned')
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/notifications')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/notifications', () => {
  it('marks all notifications as read', async () => {
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }))
    const req = new NextRequest('http://localhost/api/notifications', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/notifications', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Create the [id] route test file**

Create `src/app/api/notifications/[id]/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const ctx = { params: { id: 'n1' } }

function makeReq() {
  return new NextRequest('http://localhost/api/notifications/n1', { method: 'PATCH' })
}

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('PATCH /api/notifications/[id]', () => {
  it('marks a single notification as read', async () => {
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }))
    const res = await PATCH(makeReq(), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await PATCH(makeReq(), ctx)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run all notification tests**

```bash
npx jest --testPathPatterns=src/app/api/notifications --no-coverage
```

Expected: 6 tests pass (4 in route.test.ts, 2 in [id]/route.test.ts).

- [ ] **Step 4: Run the full test suite to verify no regressions**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/__tests__/route.test.ts
git add "src/app/api/notifications/[id]/__tests__/route.test.ts"
git commit -m "test: add 401 cases and [id] route coverage for notifications API"
```
