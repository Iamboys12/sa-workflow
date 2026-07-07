# Phase 3: Task Assignment & Member Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow SA and Tech Lead users to assign tasks to project members with due dates; let assignees update their own task status; add a "My Tasks" page; send in-app notifications one day before task due dates.

**Architecture:** Authorization logic in `PATCH /api/tasks/[id]` is reworked to enforce two tiers (SA/TL full access, assignee status-only). `TaskItem` gains an assignee dropdown and due-date input rendered for users with assign permission. A new server component at `/my-tasks` queries tasks directly via Supabase. A pg_cron job inserts due-date notifications daily.

**Tech Stack:** Next.js 14 App Router, Supabase JS v2, React Testing Library, Jest 30, `@tanstack/react-query`

## Global Constraints

- Test runner: `npx jest --testPathPatterns=<path>` (plural flag)
- All API routes: auth check before any DB query
- ESLint: no unused imports — every imported name must be used
- No `any` types except where Supabase's inferred types are nested beyond two levels (cast with a typed interface)
- Supabase join syntax: `table!fk_column(fields)` to disambiguate multiple FKs
- Client components: `'use client'` at top of file

---

## File Map

| File | Action | Responsible Task |
|------|--------|-----------------|
| `supabase/migrations/20260707000001_due_date_cron.sql` | Create | Task 1 |
| `src/app/api/tasks/[id]/route.ts` | Modify | Task 2 |
| `src/app/api/tasks/[id]/__tests__/route.test.ts` | Create | Task 2 |
| `src/app/api/my-tasks/route.ts` | Create | Task 3 |
| `src/app/api/my-tasks/__tests__/route.test.ts` | Create | Task 3 |
| `src/components/task-item.tsx` | Modify | Task 4 |
| `src/components/task-list.tsx` | Modify | Task 4 |
| `src/components/__tests__/task-item.test.tsx` | Create | Task 4 |
| `src/app/(app)/projects/[id]/steps/[stepId]/page.tsx` | Modify | Task 5 |
| `src/app/(app)/my-tasks/page.tsx` | Create | Task 5 |
| `src/components/nav.tsx` | Modify | Task 5 |

---

### Task 1: DB Migration — pg_cron Due-Date Reminder

**Files:**
- Create: `supabase/migrations/20260707000001_due_date_cron.sql`

**Interfaces:**
- Produces: cron job `due-date-reminder` in `cron.job` table; inserts rows into `notifications(user_id, type, payload)`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260707000001_due_date_cron.sql`:

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

- [ ] **Step 2: Apply migration (Supabase local) or note for remote**

If running Supabase locally:
```bash
supabase db reset
```
If using remote Supabase, apply via the dashboard SQL editor or `supabase db push`.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\User\Documents\sa-workflow
git add supabase/migrations/20260707000001_due_date_cron.sql
git commit -m "feat: pg_cron job for due-date notifications (1 day before)"
```

---

### Task 2: PATCH /api/tasks/[id] — Authorization Rework + Tests

**Files:**
- Modify: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: existing `DELETE` export in same file (keep unchanged)
- Produces:
  - `PATCH(req, { params: { id } })` → enforces SA/TL/assignee tiers
  - SA or TL: accepts `title | description | status | due_date | assigned_to`
  - Assignee (non-SA, non-TL, `assigned_to === user.id`): accepts `status` only
  - Anyone else: 403

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/tasks/[id]/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockUpdateFn = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const ctx = { params: { id: 'task1' } }

const taskRow = { assigned_to: 'u2', project_steps: { project_id: 'p1' } }
const updatedTask = { id: 'task1', status: 'in_progress', assigned_to: 'u3' }

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/task1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function setupMocks({
  role = 'sa',
  membership = null as null | { role: string },
  assignedTo = 'u2',
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockUpdateFn.mockClear()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tasks') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({
        data: { assigned_to: assignedTo, project_steps: { project_id: 'p1' } },
      }) }) }),
      update: (updates: unknown) => {
        mockUpdateFn(updates)
        return { eq: () => ({ select: () => ({ single: jest.fn().mockResolvedValue({
          data: updatedTask, error: null,
        }) }) }) }
      },
    }
    if (table === 'profiles') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role } }) }) }),
    }
    if (table === 'project_members') return {
      select: () => ({ eq: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({
        data: membership,
      }) }) }) }),
    }
    return {}
  })
}

describe('PATCH /api/tasks/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await PATCH(makeReq({ status: 'done' }), ctx)
    expect(res.status).toBe(401)
  })

  it('SA can update any field', async () => {
    setupMocks({ role: 'sa' })
    const res = await PATCH(makeReq({ status: 'done', assigned_to: 'u3', due_date: '2026-07-10' }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', assigned_to: 'u3', due_date: '2026-07-10' })
    )
  })

  it('TL in project can update any field', async () => {
    setupMocks({ role: 'pm', membership: { role: 'tech_lead' } })
    const res = await PATCH(makeReq({ status: 'done', assigned_to: 'u3' }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', assigned_to: 'u3' })
    )
  })

  it('assignee (non-SA, non-TL) can only update status', async () => {
    setupMocks({ role: 'pm', membership: null, assignedTo: 'u1' })
    const res = await PATCH(makeReq({ status: 'done', assigned_to: 'u3' }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdateFn).toHaveBeenCalledWith({ status: 'done' })
    expect(mockUpdateFn).not.toHaveBeenCalledWith(expect.objectContaining({ assigned_to: expect.anything() }))
  })

  it('returns 403 for non-SA, non-TL, non-assignee', async () => {
    setupMocks({ role: 'pm', membership: null, assignedTo: 'u2' })
    const res = await PATCH(makeReq({ status: 'done' }), ctx)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --testPathPatterns="tasks/\[id\]/__tests__" --no-coverage
```

Expected: 4 failures (PATCH not yet updated)

- [ ] **Step 3: Rewrite PATCH in `src/app/api/tasks/[id]/route.ts`**

Replace the file content (keeping `DELETE` unchanged):

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const FULL_FIELDS = ['title', 'description', 'status', 'due_date', 'assigned_to']
const ASSIGNEE_FIELDS = ['status']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, project_steps!project_step_id(project_id)')
    .eq('id', params.id)
    .single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projectId = (task.project_steps as { project_id: string }).project_id

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  let allowedFields: string[]

  if (profile?.role === 'sa') {
    allowedFields = FULL_FIELDS
  } else {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (membership?.role === 'tech_lead') {
      allowedFields = FULL_FIELDS
    } else if (task.assigned_to === user.id) {
      allowedFields = ASSIGNEE_FIELDS
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowedFields.includes(k))
  )

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run all tests and verify**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --no-coverage
```

Expected: all prior tests still pass + 5 new tests pass

- [ ] **Step 5: Build check**

```bash
cd C:\Users\User\Documents\sa-workflow
npm run build
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tasks/[id]/route.ts src/app/api/tasks/[id]/__tests__/route.test.ts
git commit -m "feat: PATCH /api/tasks/[id] — SA/TL full access, assignee status-only"
```

---

### Task 3: GET /api/my-tasks — New Endpoint + Tests

**Files:**
- Create: `src/app/api/my-tasks/route.ts`
- Create: `src/app/api/my-tasks/__tests__/route.test.ts`

**Interfaces:**
- Produces: `GET /api/my-tasks` → `200` with array of:
  ```typescript
  {
    id: string
    title: string
    status: string
    due_date: string | null
    project_step_id: string
    project_id: string
    project_name: string
    step_title: string   // template title or "Step N"
    step_order: number
  }[]
  ```
  Sorted: `due_date ASC NULLS LAST`, then `created_at ASC`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/my-tasks/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET } from '../route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const rawRow = {
  id: 't1',
  title: 'Fix auth bug',
  status: 'todo',
  due_date: '2026-07-10',
  project_step_id: 'ps1',
  step: {
    project_id: 'p1',
    order: 2,
    project: { name: 'Project Alpha' },
    template_step: { title: 'Code Review', order: 2 },
  },
}

const rawRowNoTemplate = {
  ...rawRow,
  id: 't2',
  step: { ...rawRow.step, template_step: null },
}

function setupMocks({ user = { id: 'u1' }, rows = [rawRow] } = {}) {
  mockGetUser.mockResolvedValue({ data: { user } })
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        order: () => ({
          order: jest.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    }),
  })
}

describe('GET /api/my-tasks', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns tasks shaped for My Tasks page', async () => {
    setupMocks()
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({
      id: 't1',
      title: 'Fix auth bug',
      status: 'todo',
      due_date: '2026-07-10',
      project_id: 'p1',
      project_name: 'Project Alpha',
      step_title: 'Code Review',
      step_order: 2,
    })
  })

  it('falls back to "Step N" when template_step is null', async () => {
    setupMocks({ rows: [rawRowNoTemplate] })
    const res = await GET()
    const json = await res.json()
    expect(json[0].step_title).toBe('Step 2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --testPathPatterns="my-tasks/__tests__" --no-coverage
```

Expected: 3 failures (route doesn't exist yet)

- [ ] **Step 3: Create `src/app/api/my-tasks/route.ts`**

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface StepJoin {
  project_id: string
  order: number
  project: { name: string } | null
  template_step: { title: string; order: number } | null
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('tasks')
    .select(`
      id, title, status, due_date, project_step_id,
      step:project_steps!project_step_id(
        project_id, order,
        project:projects!project_id(name),
        template_step:workflow_template_steps!template_step_id(title, order)
      )
    `)
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tasks = (rows ?? []).map(t => {
    const step = t.step as unknown as StepJoin
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      project_step_id: t.project_step_id,
      project_id: step.project_id,
      project_name: step.project?.name ?? '',
      step_title: step.template_step?.title ?? `Step ${step.order}`,
      step_order: step.order,
    }
  })

  return NextResponse.json(tasks)
}
```

- [ ] **Step 4: Run all tests and verify**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --no-coverage
```

Expected: all previous tests pass + 3 new tests pass

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/my-tasks/route.ts src/app/api/my-tasks/__tests__/route.test.ts
git commit -m "feat: GET /api/my-tasks — tasks assigned to current user"
```

---

### Task 4: TaskItem + TaskList — Assignee Select, Due Date, Assignee Status Toggle + Tests

**Files:**
- Modify: `src/components/task-item.tsx`
- Modify: `src/components/task-list.tsx`
- Create: `src/components/__tests__/task-item.test.tsx`

**Interfaces:**
- Consumes: `GET /api/members?project_id=X` → `{ user_id: string, profile: { id: string, full_name: string } }[]`
- Produces: `TaskItem` props:
  ```typescript
  {
    task: Task
    isSA: boolean
    canAssign: boolean      // new — SA or TL in project
    projectId: string       // new — used to fetch member list
    currentUserId: string   // new — determines if user is assignee
    onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
    onDelete: (id: string) => Promise<void>
  }
  ```
- Produces: `TaskList` props:
  ```typescript
  {
    stepId: string
    isSA: boolean
    canAssign: boolean      // new
    projectId: string       // new
    currentUserId: string   // new
  }
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/task-item.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import TaskItem from '../task-item'
import type { Task } from '@/lib/types'

const mockTask: Task = {
  id: 't1',
  project_step_id: 'ps1',
  title: 'Write tests',
  description: '',
  assigned_to: null,
  status: 'todo',
  due_date: null,
  created_by: 'u1',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const baseProps = {
  task: mockTask,
  isSA: false,
  canAssign: false,
  projectId: 'p1',
  currentUserId: 'u1',
  onUpdate: jest.fn(),
  onDelete: jest.fn(),
}

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    json: () => Promise.resolve([]),
  } as Response)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('TaskItem', () => {
  it('renders task title', () => {
    render(<TaskItem {...baseProps} />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
  })

  it('does not show assignee select or due date input when canAssign is false', () => {
    const { container } = render(<TaskItem {...baseProps} canAssign={false} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('shows assignee select and due date input when canAssign is true', () => {
    const { container } = render(<TaskItem {...baseProps} canAssign={true} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).not.toBeNull()
  })

  it('shows delete button only when isSA is true', () => {
    const { rerender } = render(<TaskItem {...baseProps} isSA={false} />)
    expect(screen.queryByText('×')).not.toBeInTheDocument()
    rerender(<TaskItem {...baseProps} isSA={true} />)
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('shows status toggle when task is assigned to currentUserId', () => {
    const assignedTask = { ...mockTask, assigned_to: 'u1' }
    render(<TaskItem {...baseProps} task={assignedTask} currentUserId="u1" isSA={false} />)
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --testPathPatterns="__tests__/task-item" --no-coverage
```

Expected: several failures (props don't exist yet)

- [ ] **Step 3: Rewrite `src/components/task-item.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/lib/types'

const nextStatus: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

const statusStyle: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

interface Member {
  user_id: string
  profile: { id: string; full_name: string }
}

export default function TaskItem({
  task,
  isSA,
  canAssign,
  projectId,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  task: Task
  isSA: boolean
  canAssign: boolean
  projectId: string
  currentUserId: string
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!canAssign) return
    fetch(`/api/members?project_id=${projectId}`)
      .then(r => r.json())
      .then(setMembers)
  }, [canAssign, projectId])

  const isAssignee = task.assigned_to === currentUserId
  const canToggleStatus = isSA || isAssignee

  async function toggleStatus() {
    setLoading(true)
    await onUpdate(task.id, { status: nextStatus[task.status] })
    setLoading(false)
  }

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      task.status === 'done' && 'opacity-60'
    )}>
      {canToggleStatus && (
        <button
          onClick={toggleStatus}
          disabled={loading}
          className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-400 flex items-center justify-center hover:border-blue-500"
        >
          {task.status === 'done' && <span className="text-xs text-green-600">✓</span>}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', task.status === 'done' && 'line-through text-gray-400')}>
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-gray-400">Due {task.due_date}</p>
        )}
        {task.assignee && !canAssign && (
          <p className="text-xs text-gray-400">Assigned to {task.assignee.full_name}</p>
        )}
      </div>
      {canAssign && (
        <select
          value={task.assigned_to ?? ''}
          onChange={e => onUpdate(task.id, { assigned_to: e.target.value || null })}
          className="text-xs border rounded px-1 py-0.5 text-gray-600 max-w-[130px]"
        >
          <option value="">Unassigned</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>
          ))}
        </select>
      )}
      {canAssign && (
        <input
          type="date"
          value={task.due_date ?? ''}
          onChange={e => onUpdate(task.id, { due_date: e.target.value || null })}
          className="text-xs border rounded px-1 py-0.5 text-gray-600"
        />
      )}
      <Badge className={statusStyle[task.status]}>{task.status}</Badge>
      {isSA && (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 h-7"
          onClick={() => onDelete(task.id)}
        >
          ×
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `src/components/task-list.tsx`**

Add `canAssign`, `projectId`, `currentUserId` props and pass them to `TaskItem`. Replace the entire file:

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TaskItem from './task-item'
import type { Task } from '@/lib/types'

async function fetchTasks(stepId: string): Promise<Task[]> {
  const res = await fetch(`/api/tasks?step_id=${stepId}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export default function TaskList({
  stepId,
  isSA,
  canAssign,
  projectId,
  currentUserId,
}: {
  stepId: string
  isSA: boolean
  canAssign: boolean
  projectId: string
  currentUserId: string
}) {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', stepId],
    queryFn: () => fetchTasks(stepId),
  })

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_step_id: stepId, title }),
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createMutation.mutateAsync(newTitle.trim())
    setNewTitle('')
  }

  if (isLoading) return <p className="text-gray-500 text-sm">Loading tasks…</p>

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          isSA={isSA}
          canAssign={canAssign}
          projectId={projectId}
          currentUserId={currentUserId}
          onUpdate={(id, updates) => updateMutation.mutateAsync({ id, updates })}
          onDelete={(id) => deleteMutation.mutateAsync(id)}
        />
      ))}

      {isSA && (
        <form onSubmit={handleCreate} className="flex gap-2 mt-3">
          <Input
            placeholder="Add a task…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run all tests and verify**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --no-coverage
```

Expected: all previous tests pass + 5 new task-item tests pass

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: no errors (TypeScript will catch any prop mismatch)

- [ ] **Step 7: Commit**

```bash
git add src/components/task-item.tsx src/components/task-list.tsx src/components/__tests__/task-item.test.tsx
git commit -m "feat: TaskItem/TaskList — assignee select, due date input, assignee status toggle"
```

---

### Task 5: Step Detail Page canAssign + My Tasks Page + Nav Link

**Files:**
- Modify: `src/app/(app)/projects/[id]/steps/[stepId]/page.tsx`
- Create: `src/app/(app)/my-tasks/page.tsx`
- Modify: `src/components/nav.tsx`

**Interfaces:**
- Consumes: `TaskList` with `canAssign`, `projectId`, `currentUserId` props (from Task 4)
- Consumes: Supabase `tasks` table joined to `project_steps → projects + workflow_template_steps` (same shape as Task 3 API route)

- [ ] **Step 1: Update `src/app/(app)/projects/[id]/steps/[stepId]/page.tsx`**

Add TL membership check and pass new props to `TaskList`. Replace the file:

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import TaskList from '@/components/task-list'
import StepStatusSelect from '@/components/step-status-select'

const modelColors: Record<string, string> = {
  'human-led':   'bg-purple-100 text-purple-700',
  'ai-assisted': 'bg-orange-100 text-orange-700',
  'paired':      'bg-teal-100 text-teal-700',
}

export default async function StepDetailPage({
  params,
}: {
  params: { id: string; stepId: string }
}) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const { data: step } = await supabase
    .from('project_steps')
    .select('*, template_step:workflow_template_steps(*)')
    .eq('id', params.stepId)
    .single()

  if (!step) notFound()

  const isSA = profile?.role === 'sa'

  let isTL = false
  if (!isSA) {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', params.id)
      .eq('user_id', user!.id)
      .single()
    isTL = membership?.role === 'tech_lead'
  }

  const canAssign = isSA || isTL

  const title = step.template_step?.title ?? `Step ${step.order}`
  const model = step.template_step?.collaboration_model
  const deliverables: string[] = step.template_step?.deliverables ?? []

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href={`/projects/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to project
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-gray-400 text-sm">Step {step.order}</span>
        <h1 className="text-2xl font-bold">{title}</h1>
        {model && <Badge className={modelColors[model]}>{model}</Badge>}
        {isSA && (
          <StepStatusSelect
            projectId={params.id}
            stepId={params.stepId}
            status={step.status}
          />
        )}
      </div>

      {deliverables.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Expected Deliverables</h2>
          <ul className="space-y-1">
            {deliverables.map((d, i) => (
              <li key={i} className="text-sm text-gray-700">• {d}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Tasks</h2>
        <TaskList
          stepId={step.id}
          isSA={isSA}
          canAssign={canAssign}
          projectId={params.id}
          currentUserId={user!.id}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(app)/my-tasks/page.tsx`**

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

const statusStyle: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done:        'bg-green-100 text-green-700',
}

interface StepJoin {
  project_id: string
  order: number
  project: { name: string } | null
  template_step: { title: string } | null
}

export default async function MyTasksPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const { data: rows = [] } = await supabase
    .from('tasks')
    .select(`
      id, title, status, due_date, project_step_id,
      step:project_steps!project_step_id(
        project_id, order,
        project:projects!project_id(name),
        template_step:workflow_template_steps!template_step_id(title, order)
      )
    `)
    .eq('assigned_to', user!.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Tasks</h1>

      {rows.length === 0 && (
        <p className="text-gray-500">No tasks assigned to you yet.</p>
      )}

      <div className="space-y-3">
        {rows.map(t => {
          const step = t.step as unknown as StepJoin
          const projectId = step.project_id
          const projectName = step.project?.name ?? ''
          const stepTitle = step.template_step?.title ?? `Step ${step.order}`
          const isOverdue = t.due_date !== null && t.due_date < today && t.status !== 'done'

          return (
            <div key={t.id} className="p-4 border rounded-lg bg-white">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/projects/${projectId}/steps/${t.project_step_id}`}
                  className="text-sm font-medium hover:underline flex-1"
                >
                  {t.title}
                </Link>
                <Badge className={statusStyle[t.status] ?? 'bg-gray-100 text-gray-700'}>
                  {t.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{projectName} › {stepTitle}</span>
                {t.due_date && (
                  <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    Due {t.due_date}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add "My Tasks" link to `src/components/nav.tsx`**

Add the link inside the left `div` that already has Dashboard and Templates:

```typescript
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import NotificationBell from '@/components/notification-bell'
import type { Profile } from '@/lib/types'

export default function Nav({ profile }: { profile: Profile | null }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b bg-white px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold text-gray-900">SA Workflow</Link>
        {profile && (
          <Link href="/my-tasks" className="text-sm text-gray-600 hover:text-gray-900">
            My Tasks
          </Link>
        )}
        {profile?.role === 'sa' && (
          <Link href="/settings/templates" className="text-sm text-gray-600 hover:text-gray-900">
            Templates
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {profile && <NotificationBell userId={profile.id} />}
        <span className="text-sm text-gray-600">{profile?.full_name}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run all tests and verify**

```bash
cd C:\Users\User\Documents\sa-workflow
npx jest --no-coverage
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, no ESLint errors

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/projects/[id]/steps/[stepId]/page.tsx src/app/(app)/my-tasks/page.tsx src/components/nav.tsx
git commit -m "feat: canAssign on step detail, My Tasks page, nav link"
```

---

## Summary

| Task | Files | Tests |
|------|-------|-------|
| 1 — pg_cron migration | 1 SQL file | — |
| 2 — PATCH /api/tasks/[id] auth | 2 files | 5 tests |
| 3 — GET /api/my-tasks | 2 files | 3 tests |
| 4 — TaskItem/TaskList UI | 3 files | 5 tests |
| 5 — Step page + My Tasks + Nav | 3 files | — |
