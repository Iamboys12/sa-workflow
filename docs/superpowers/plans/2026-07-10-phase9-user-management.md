# Phase 9: User & Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings/users` page for SA to manage system users (global role + deactivate/reactivate) and upgrade the `/projects/[id]/members` page so SA can change project roles and remove members inline.

**Architecture:** Migration adds `is_active` to `profiles`. A new `/api/admin/users` route handles system user management via Supabase Admin API. A new PATCH handler is added to `/api/members` for project role changes. Two new client components (`UserList`, `MemberList`) provide optimistic-update UIs, rendered by server components that enforce SA-only access.

**Tech Stack:** Next.js 14 App Router, Supabase JS v2 + Admin client, React Testing Library + Jest 30.

## Global Constraints

- Test runner: `npx jest --testPathPatterns=<path> --no-coverage` (plural flag, no coverage flag)
- All API route test files must have `/** @jest-environment node */` at the top
- `mockGetUser = jest.fn()` pattern — separate variable for per-test override, `jest.clearAllMocks()` in `afterEach`
- `global.fetch = jest.fn()` for component tests (NOT `jest.spyOn`)
- No `any` types — use typed interfaces
- Auth check (`getUser`) must be first in every route before any DB query
- `'use client'` required on `UserList` and `MemberList`
- `data-testid` attributes: `user-list`, `user-row-{id}`, `role-select-{id}`, `deactivate-btn-{id}`, `member-list`, `member-row-{id}`, `member-role-select-{id}`, `remove-btn-{id}`
- SA-only pages redirect non-SA to `/dashboard`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260710000001_user_active.sql` | Add `is_active` to profiles |
| Modify | `src/lib/types.ts` | Add `is_active: boolean` to Profile interface |
| Create | `src/app/api/admin/users/route.ts` | GET list + PATCH role/deactivate (SA only) |
| Create | `src/app/api/admin/users/__tests__/route.test.ts` | 6 API tests |
| Create | `src/components/user-list.tsx` | Client Component — users table |
| Create | `src/components/__tests__/user-list.test.tsx` | 8 component tests |
| Create | `src/app/(app)/settings/users/page.tsx` | Server Component — system users page |
| Modify | `src/components/nav.tsx` | Add Users nav link for SA |
| Modify | `src/app/api/members/route.ts` | Add PATCH handler for project role change |
| Modify | `src/app/api/members/__tests__/route.test.ts` | Refactor + add 2 PATCH tests |
| Create | `src/components/member-list.tsx` | Client Component — project members table |
| Create | `src/components/__tests__/member-list.test.tsx` | 6 component tests |
| Modify | `src/app/(app)/projects/[id]/members/page.tsx` | Replace static list with MemberList |

---

### Task 1: Migration + Profile Type

**Files:**
- Create: `supabase/migrations/20260710000001_user_active.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `Profile.is_active: boolean` — consumed by Tasks 2, 3, 4

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260710000001_user_active.sql`:

```sql
alter table profiles add column is_active boolean not null default true;
```

- [ ] **Step 2: Update Profile type**

In `src/lib/types.ts`, add `is_active` to the Profile interface:

```typescript
export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}
```

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests pass (no compile errors from type change).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710000001_user_active.sql src/lib/types.ts
git commit -m "feat: add is_active column to profiles and update Profile type"
```

---

### Task 2: Admin Users API Route + Tests

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `Profile.is_active` from Task 1, `createAdminSupabase` from `@/lib/supabase/admin`
- Produces:
  - `GET /api/admin/users` → `{ users: Profile[] }` (200) or 401/403
  - `PATCH /api/admin/users` body `{ user_id, role?, is_active? }` → updated Profile (200) or 401/403

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/admin/users/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockAdminUpdate = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: jest.fn().mockReturnValue({
    auth: { admin: { updateUserById: (...args: unknown[]) => mockAdminUpdate(...args) } },
  }),
}))

const sampleUsers = [
  { id: 'u1', full_name: 'Alice', role: 'sa', is_active: true, created_at: '2026-01-01' },
  { id: 'u2', full_name: 'Bob', role: 'pm', is_active: false, created_at: '2026-01-01' },
]

// Returns a mock for the requester profile lookup: from('profiles').select('role').eq().single()
function makeRequesterQuery(role = 'sa') {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role }, error: null }),
      }),
    }),
  }
}

// Returns a mock for the GET all-users query: from('profiles').select(...).order(...)
function makeUsersQuery(users: unknown[]) {
  return {
    select: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: users, error: null }),
    }),
  }
}

// Returns a mock for the PATCH update query: from('profiles').update().eq().select().single()
function makeUpdateQuery(updated: unknown) {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockAdminUpdate.mockResolvedValue({ data: {}, error: null })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/admin/users', () => {
  it('returns user list for SA', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
            .mockImplementationOnce(() => makeUsersQuery(sampleUsers))
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.users).toHaveLength(2)
  })

  it('returns 403 for non-SA', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('pm'))
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/users', () => {
  it('updates role and returns updated profile', async () => {
    const updated = { id: 'u2', full_name: 'Bob', role: 'tech_lead', is_active: true }
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
            .mockImplementationOnce(() => makeUpdateQuery(updated))
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'u2', role: 'tech_lead' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.role).toBe('tech_lead')
  })

  it('deactivates user — updates is_active and calls adminUpdate with ban_duration', async () => {
    const updated = { id: 'u2', full_name: 'Bob', role: 'pm', is_active: false }
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
            .mockImplementationOnce(() => makeUpdateQuery(updated))
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'u2', is_active: false }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockAdminUpdate).toHaveBeenCalledWith('u2', { ban_duration: '876600h' })
  })

  it('returns 403 when SA tries to deactivate self', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'u1', is_active: false }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'u2', role: 'pm' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest --testPathPatterns=src/app/api/admin/users --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/admin/users/route.ts`:

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/lib/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: users ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { user_id: string; role?: UserRole; is_active?: boolean }
  const { user_id, role, is_active } = body

  if (is_active === false && user_id === user.id) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (is_active !== undefined) updates.is_active = is_active

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (is_active !== undefined) {
    const admin = createAdminSupabase()
    await admin.auth.admin.updateUserById(user_id, {
      ban_duration: is_active ? 'none' : '876600h',
    })
  }

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest --testPathPatterns=src/app/api/admin/users --no-coverage
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/__tests__/route.test.ts
git commit -m "feat: add admin users API route with GET list and PATCH role/deactivate"
```

---

### Task 3: UserList Component + Settings Users Page + Nav

**Files:**
- Create: `src/components/user-list.tsx`
- Create: `src/components/__tests__/user-list.test.tsx`
- Create: `src/app/(app)/settings/users/page.tsx`
- Modify: `src/components/nav.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/users` and `PATCH /api/admin/users` from Task 2
- Consumes: `Profile` (with `is_active`) from Task 1
- Produces: `UserList` component with props `{ users: Profile[], currentUserId: string }`

**Context — nav.tsx current SA links (around line 29):**
```typescript
{profile?.role === 'sa' && (
  <Link href="/settings/templates" className="text-sm text-gray-600 hover:text-gray-900">
    Templates
  </Link>
)}
```
Add a `Users` link immediately after this block.

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/user-list.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserList from '../user-list'
import type { Profile } from '@/lib/types'

const activeUser: Profile = {
  id: 'u1', full_name: 'Alice', role: 'sa', is_active: true, created_at: '2026-01-01',
}
const deactivatedUser: Profile = {
  id: 'u2', full_name: 'Bob', role: 'pm', is_active: false, created_at: '2026-01-01',
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('UserList', () => {
  it('renders all users in table rows', () => {
    render(<UserList users={[activeUser, deactivatedUser]} currentUserId="current" />)
    expect(screen.getByTestId('user-row-u1')).toBeInTheDocument()
    expect(screen.getByTestId('user-row-u2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls PATCH with { user_id, role } when role dropdown changed', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.change(screen.getByTestId('role-select-u1'), { target: { value: 'pm' } })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u1', role: 'pm' }),
      }))
    })
  })

  it('calls PATCH with { user_id, is_active: false } when Deactivate clicked', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.click(screen.getByTestId('deactivate-btn-u1'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u1', is_active: false }),
      }))
    })
  })

  it('calls PATCH with { user_id, is_active: true } when Reactivate clicked', async () => {
    render(<UserList users={[deactivatedUser]} currentUserId="current" />)
    fireEvent.click(screen.getByTestId('deactivate-btn-u2'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u2', is_active: true }),
      }))
    })
  })

  it('deactivated user row has opacity-50 class', () => {
    render(<UserList users={[deactivatedUser]} currentUserId="current" />)
    expect(screen.getByTestId('user-row-u2')).toHaveClass('opacity-50')
  })

  it('current user role select is disabled', () => {
    render(<UserList users={[activeUser]} currentUserId="u1" />)
    expect(screen.getByTestId('role-select-u1')).toBeDisabled()
  })

  it('current user deactivate button is disabled', () => {
    render(<UserList users={[activeUser]} currentUserId="u1" />)
    expect(screen.getByTestId('deactivate-btn-u1')).toBeDisabled()
  })

  it('role select shows updated value optimistically after change', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.change(screen.getByTestId('role-select-u1'), { target: { value: 'pm' } })
    await waitFor(() => {
      expect(screen.getByTestId('role-select-u1')).toHaveValue('pm')
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest --testPathPatterns=src/components/__tests__/user-list --no-coverage
```

Expected: FAIL — `Cannot find module '../user-list'`

- [ ] **Step 3: Implement UserList component**

Create `src/components/user-list.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Profile, UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  sa: 'SA',
  pm: 'PM',
  tech_lead: 'Tech Lead',
}

export default function UserList({
  users: initial,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initial)

  async function handleRoleChange(userId: string, role: UserRole) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u))
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_active: isActive }),
    })
  }

  return (
    <div data-testid="user-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Full Name</th>
            <th className="pb-2 font-medium">Global Role</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr
              key={u.id}
              data-testid={`user-row-${u.id}`}
              className={`border-b ${!u.is_active ? 'opacity-50' : ''}`}
            >
              <td className="py-3">{u.full_name}</td>
              <td className="py-3">
                <select
                  data-testid={`role-select-${u.id}`}
                  value={u.role}
                  disabled={u.id === currentUserId}
                  onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                  className="border rounded px-2 py-1 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {u.is_active ? 'Active' : 'Deactivated'}
                </span>
              </td>
              <td className="py-3">
                <button
                  data-testid={`deactivate-btn-${u.id}`}
                  disabled={u.id === currentUserId}
                  onClick={() => handleToggleActive(u.id, !u.is_active)}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run component tests**

```bash
npx jest --testPathPatterns=src/components/__tests__/user-list --no-coverage
```

Expected: 8 tests pass.

- [ ] **Step 5: Create settings users page**

Create `src/app/(app)/settings/users/page.tsx`:

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserList from '@/components/user-list'
import type { Profile } from '@/lib/types'

export default async function UsersPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'sa') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('full_name')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">System Users</h1>
      <UserList users={(users ?? []) as Profile[]} currentUserId={user!.id} />
    </div>
  )
}
```

- [ ] **Step 6: Add Users link to nav**

In `src/components/nav.tsx`, locate the Templates link block and add a Users link immediately after it:

```typescript
{profile?.role === 'sa' && (
  <Link href="/settings/templates" className="text-sm text-gray-600 hover:text-gray-900">
    Templates
  </Link>
)}
{profile?.role === 'sa' && (
  <Link href="/settings/users" className="text-sm text-gray-600 hover:text-gray-900">
    Users
  </Link>
)}
```

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/user-list.tsx src/components/__tests__/user-list.test.tsx src/app/'(app)'/settings/users/page.tsx src/components/nav.tsx
git commit -m "feat: add UserList component and /settings/users page for SA user management"
```

---

### Task 4: Members PATCH + MemberList + Updated Members Page

**Files:**
- Modify: `src/app/api/members/route.ts`
- Modify: `src/app/api/members/__tests__/route.test.ts`
- Create: `src/components/member-list.tsx`
- Create: `src/components/__tests__/member-list.test.tsx`
- Modify: `src/app/(app)/projects/[id]/members/page.tsx`

**Interfaces:**
- Consumes: existing `DELETE /api/members` from members route
- Produces:
  - `PATCH /api/members` body `{ project_id, user_id, role }` → updated project_member row
  - `MemberList` component with props `{ members: MemberWithProfile[], projectId: string, isSA: boolean }`

**Context — existing members route.ts has GET, POST, DELETE handlers. Add PATCH below DELETE.**

**Context — existing members route test has 1 test (POST 400). Refactor the whole test file to use the `mockGetUser + mockFrom` pattern so per-test control works cleanly.**

- [ ] **Step 1: Add PATCH handler to members route**

In `src/app/api/members/route.ts`, add this export after the existing DELETE handler:

```typescript
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'sa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { project_id: string; user_id: string; role: string }
  const { project_id, user_id, role } = body

  if (!['pm', 'tech_lead'].includes(role)) {
    return NextResponse.json({ error: 'role must be pm or tech_lead' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', project_id)
    .eq('user_id', user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Refactor + extend members route tests**

Replace the entire contents of `src/app/api/members/__tests__/route.test.ts` with:

```typescript
/**
 * @jest-environment node
 */
import { POST, PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: jest.fn().mockReturnValue({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({
          data: { users: [{ id: 'invite-user', email: 'pm@test.com' }] },
          error: null,
        }),
      },
    },
  }),
}))

function makeSARequesterQuery() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role: 'sa' }, error: null }),
      }),
    }),
  }
}

function makeProfilesTableChain() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role: 'sa' }, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'invite-user' }, error: null }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { project_id: 'p1', user_id: 'invite-user', role: 'pm' }, error: null,
        }),
      }),
    }),
  }
}

function makeMembersUpdateQuery(updated: unknown) {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updated, error: null }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'sa-user' } } })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/members', () => {
  it('returns 400 when role is invalid', async () => {
    mockFrom.mockImplementation(() => makeProfilesTableChain())
    const req = new NextRequest('http://localhost/api/members', {
      method: 'POST',
      body: JSON.stringify({ project_id: 'p1', email: 'pm@test.com', role: 'sa' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/role must be pm or tech_lead/i)
  })
})

describe('PATCH /api/members', () => {
  it('updates project role and returns updated row', async () => {
    const updated = { project_id: 'p1', user_id: 'u2', role: 'tech_lead' }
    mockFrom.mockImplementationOnce(() => makeSARequesterQuery())
            .mockImplementationOnce(() => makeMembersUpdateQuery(updated))
    const req = new NextRequest('http://localhost/api/members', {
      method: 'PATCH',
      body: JSON.stringify({ project_id: 'p1', user_id: 'u2', role: 'tech_lead' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.role).toBe('tech_lead')
  })

  it('returns 403 for non-SA', async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { role: 'pm' }, error: null }),
        }),
      }),
    }))
    const req = new NextRequest('http://localhost/api/members', {
      method: 'PATCH',
      body: JSON.stringify({ project_id: 'p1', user_id: 'u2', role: 'tech_lead' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 3: Run members route tests**

```bash
npx jest --testPathPatterns=src/app/api/members --no-coverage
```

Expected: 3 tests pass (1 POST + 2 PATCH).

- [ ] **Step 4: Write MemberList failing tests**

Create `src/components/__tests__/member-list.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemberList from '../member-list'
import type { Profile, ProjectMember } from '@/lib/types'

type MemberWithProfile = ProjectMember & { profile: Profile | null }

const makeProfile = (id: string, name: string): Profile => ({
  id, full_name: name, role: 'pm', is_active: true, created_at: '2026-01-01',
})

const members: MemberWithProfile[] = [
  { project_id: 'p1', user_id: 'u1', role: 'pm', profile: makeProfile('u1', 'Alice') },
  { project_id: 'p1', user_id: 'u2', role: 'tech_lead', profile: makeProfile('u2', 'Bob') },
]

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('MemberList', () => {
  it('renders all members in table rows', () => {
    render(<MemberList members={members} projectId="p1" isSA={true} />)
    expect(screen.getByTestId('member-row-u1')).toBeInTheDocument()
    expect(screen.getByTestId('member-row-u2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls PATCH with { project_id, user_id, role } when role dropdown changed (SA)', async () => {
    render(<MemberList members={members} projectId="p1" isSA={true} />)
    fireEvent.change(screen.getByTestId('member-role-select-u1'), { target: { value: 'tech_lead' } })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/members', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ project_id: 'p1', user_id: 'u1', role: 'tech_lead' }),
      }))
    })
  })

  it('calls DELETE with { project_id, user_id } when Remove clicked (SA)', async () => {
    render(<MemberList members={members} projectId="p1" isSA={true} />)
    fireEvent.click(screen.getByTestId('remove-btn-u1'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/members', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ project_id: 'p1', user_id: 'u1' }),
      }))
    })
  })

  it('member row disappears optimistically after Remove clicked', async () => {
    render(<MemberList members={members} projectId="p1" isSA={true} />)
    fireEvent.click(screen.getByTestId('remove-btn-u1'))
    await waitFor(() => {
      expect(screen.queryByTestId('member-row-u1')).not.toBeInTheDocument()
    })
  })

  it('role selects and Remove buttons not rendered for non-SA', () => {
    render(<MemberList members={members} projectId="p1" isSA={false} />)
    expect(screen.queryByTestId('member-role-select-u1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('remove-btn-u1')).not.toBeInTheDocument()
  })

  it('shows empty state when members array is empty', () => {
    render(<MemberList members={[]} projectId="p1" isSA={true} />)
    expect(screen.getByText('No members yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run MemberList tests to confirm they fail**

```bash
npx jest --testPathPatterns=src/components/__tests__/member-list --no-coverage
```

Expected: FAIL — `Cannot find module '../member-list'`

- [ ] **Step 6: Implement MemberList component**

Create `src/components/member-list.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Profile, ProjectMember } from '@/lib/types'

type MemberWithProfile = ProjectMember & { profile: Profile | null }
type ProjectRole = 'pm' | 'tech_lead'

const ROLE_LABELS: Record<ProjectRole, string> = { pm: 'PM', tech_lead: 'Tech Lead' }
const PROJECT_ROLES: ProjectRole[] = ['pm', 'tech_lead']

export default function MemberList({
  members: initial,
  projectId,
  isSA,
}: {
  members: MemberWithProfile[]
  projectId: string
  isSA: boolean
}) {
  const [members, setMembers] = useState(initial)

  if (members.length === 0) {
    return <p className="text-sm text-gray-500">No members yet.</p>
  }

  async function handleRoleChange(userId: string, role: ProjectRole) {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
    await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
    })
  }

  async function handleRemove(userId: string) {
    setMembers(prev => prev.filter(m => m.user_id !== userId))
    await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, user_id: userId }),
    })
  }

  return (
    <div data-testid="member-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Full Name</th>
            <th className="pb-2 font-medium">Project Role</th>
            {isSA && <th className="pb-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.user_id} data-testid={`member-row-${m.user_id}`} className="border-b">
              <td className="py-3">{m.profile?.full_name ?? m.user_id}</td>
              <td className="py-3">
                {isSA ? (
                  <select
                    data-testid={`member-role-select-${m.user_id}`}
                    value={m.role}
                    onChange={e => handleRoleChange(m.user_id, e.target.value as ProjectRole)}
                    className="border rounded px-2 py-1 text-xs bg-white"
                  >
                    {PROJECT_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-600">
                    {ROLE_LABELS[m.role as ProjectRole] ?? m.role}
                  </span>
                )}
              </td>
              {isSA && (
                <td className="py-3">
                  <button
                    data-testid={`remove-btn-${m.user_id}`}
                    onClick={() => handleRemove(m.user_id)}
                    className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Run MemberList tests**

```bash
npx jest --testPathPatterns=src/components/__tests__/member-list --no-coverage
```

Expected: 6 tests pass.

- [ ] **Step 8: Update members page**

Replace the static badge list in `src/app/(app)/projects/[id]/members/page.tsx`. The current import section and the `<div className="space-y-2 mb-8">` block need updating:

```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import InviteMemberForm from '@/components/invite-member-form'
import MemberList from '@/components/member-list'
import type { ProjectMember, Profile } from '@/lib/types'

type MemberWithProfile = ProjectMember & { profile: Profile | null }

export default async function MembersPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'sa') redirect(`/projects/${params.id}`)

  const { data: project } = await supabase
    .from('projects').select('name').eq('id', params.id).single()
  if (!project) notFound()

  const { data: members } = await supabase
    .from('project_members')
    .select('*, profile:profiles(id, full_name, role, is_active, created_at)')
    .eq('project_id', params.id)

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <Link href={`/projects/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to project
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Members — {project.name}</h1>

      <div className="mb-8">
        <MemberList
          members={(members ?? []) as MemberWithProfile[]}
          projectId={params.id}
          isSA={true}
        />
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
        <InviteMemberForm projectId={params.id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass (132 existing + 17 new = 149 total).

- [ ] **Step 10: Commit**

```bash
git add src/app/api/members/route.ts src/app/api/members/__tests__/route.test.ts src/components/member-list.tsx src/components/__tests__/member-list.test.tsx src/app/'(app)'/projects/'[id]'/members/page.tsx
git commit -m "feat: add project member role change, MemberList component, and updated members page"
```
