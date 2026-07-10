# Phase 9: User & Role Management Design

## Overview

Add two management surfaces for SA users: a system-level Users page at `/settings/users` where SA can change global roles and deactivate/reactivate accounts, and an improved Project Members page at `/projects/[id]/members` where SA can change project roles and remove members inline.

## Scope

- **In:** system users list + global role change + deactivate/reactivate; project member list + project role change + remove member
- **Out:** self-service profile editing, user invitation flow changes (InviteMemberForm stays as-is), project lead designation, viewing which projects a user belongs to

## Architecture

```
/settings/users (Server Component)
  → UserList ('use client')
      → PATCH /api/admin/users

/projects/[id]/members (Server Component, modified)
  → MemberList ('use client')   ← new, replaces static badge list
      → PATCH /api/members      ← new handler
      → DELETE /api/members     ← existing
  → InviteMemberForm            ← unchanged
```

**Deactivation mechanism:** `is_active boolean default true` added to `profiles` table via migration. PATCH sets both `profiles.is_active` and calls `admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })` atomically. Reactivation sets `is_active = true` and `ban_duration: 'none'`. Storing `is_active` in profiles avoids calling the admin API just to render the user list.

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260710000001_user_active.sql` | Add `is_active` column to profiles |
| Create | `src/app/api/admin/users/route.ts` | GET list users, PATCH role/deactivate (SA only) |
| Create | `src/app/api/admin/users/__tests__/route.test.ts` | 6 API tests |
| Create | `src/app/(app)/settings/users/page.tsx` | Server Component — fetch users, render UserList |
| Create | `src/components/user-list.tsx` | Client Component — users table with role + deactivate |
| Create | `src/components/__tests__/user-list.test.tsx` | 8 component tests |
| Create | `src/components/member-list.tsx` | Client Component — members table with role change + remove |
| Create | `src/components/__tests__/member-list.test.tsx` | 6 component tests |
| Modify | `src/app/api/members/route.ts` | Add PATCH handler for project role change |
| Modify | `src/app/api/members/__tests__/route.test.ts` | Add 2 PATCH tests |
| Modify | `src/app/(app)/projects/[id]/members/page.tsx` | Replace static list with MemberList |
| Modify | `src/components/nav.tsx` | Add Users link in settings nav (SA only) |

## Migration

```sql
alter table profiles add column is_active boolean not null default true;
```

No RLS change needed — deactivated users are banned at the auth layer and cannot make requests regardless.

## API

### GET /api/admin/users

- SA only (403 otherwise), 401 if unauthenticated
- Selects `id, full_name, role, is_active, created_at` from `profiles` ordered by `full_name`
- Response: `{ users: Profile[] }`

### PATCH /api/admin/users

- Body: `{ user_id: string, role?: UserRole, is_active?: boolean }` — at least one of `role` or `is_active` required
- SA only (403), 401 if unauthenticated
- Cannot deactivate self: if `user_id === requester.id` and `is_active === false` → 403
- If `role` provided: `UPDATE profiles SET role = $role WHERE id = $user_id`
- If `is_active = false`: `UPDATE profiles SET is_active = false` + `admin.auth.admin.updateUserById(user_id, { ban_duration: '876600h' })`
- If `is_active = true`: `UPDATE profiles SET is_active = true` + `admin.auth.admin.updateUserById(user_id, { ban_duration: 'none' })`
- Response: updated profile row

### PATCH /api/members (new handler added to existing route)

- Body: `{ project_id: string, user_id: string, role: 'pm' | 'tech_lead' }`
- SA only (403), 401 if unauthenticated
- `UPDATE project_members SET role = $role WHERE project_id = $project_id AND user_id = $user_id`
- Response: updated row

## Components

### UserList (`src/components/user-list.tsx`) — `'use client'`

Props: `{ users: Profile[], currentUserId: string }`

Table columns: Full Name | Global Role | Status | Actions

- **Role column:** `<select>` with options `sa / pm / tech_lead` — onChange calls `PATCH /api/admin/users` with `{ user_id, role }`, optimistic update of local state
- **Status column:** badge — green `Active` or red `Deactivated`
- **Actions column:** button `Deactivate` / `Reactivate` — calls `PATCH /api/admin/users` with `{ user_id, is_active }`
- Current user row: role select disabled, deactivate button disabled (cannot self-deactivate)
- Deactivated user row: `opacity-50` class on row

`data-testid`: `user-list`, `user-row-{id}`, `role-select-{id}`, `deactivate-btn-{id}`

### Settings Users Page (`/settings/users`) — Server Component

- Redirect to `/dashboard` if `profile.role !== 'sa'`
- Fetches all profiles ordered by `full_name`
- Renders `<UserList users={users} currentUserId={user.id} />`
- Nav: add `Users` link to settings nav alongside `Templates` (SA only)

### MemberList (`src/components/member-list.tsx`) — `'use client'`

Props: `{ members: MemberWithProfile[], projectId: string, isSA: boolean }`

Table columns: Full Name | Project Role | Actions (SA only)

- **Project Role column (SA only):** `<select>` with `pm / tech_lead` — onChange calls `PATCH /api/members` with `{ project_id, user_id, role }`, optimistic update
- **Actions column (SA only):** `Remove` button — calls `DELETE /api/members`, optimistic remove from list
- Non-SA users: read-only table (no selects, no remove buttons)
- Empty state: "No members yet."

`data-testid`: `member-list`, `member-row-{id}`, `member-role-select-{id}`, `remove-btn-{id}`

### Modified Members Page (`/projects/[id]/members`)

Replace static badge list with `<MemberList members={members} projectId={params.id} isSA={true} />`. `InviteMemberForm` stays in place below.

## Tests

### `src/app/api/admin/users/__tests__/route.test.ts` (6 tests)

Mock pattern: `mockGetUser = jest.fn()`, `mockFrom = jest.fn()`, `mockAdminUpdate = jest.fn()`
Mock `@/lib/supabase/server` + `@/lib/supabase/admin`

1. GET returns user list for SA
2. GET returns 403 for non-SA
3. PATCH updates role and returns updated profile
4. PATCH deactivates user — updates `is_active` and calls `adminUpdate` with `ban_duration: '876600h'`
5. PATCH returns 403 when SA tries to deactivate self
6. PATCH returns 401 when unauthenticated

### `src/app/api/members/__tests__/route.test.ts` (add 2 tests)

7. PATCH updates project role and returns updated row
8. PATCH returns 403 for non-SA

### `src/components/__tests__/user-list.test.tsx` (8 tests)

Mock: `global.fetch = jest.fn()`, `jest.clearAllMocks()` in afterEach

1. Renders all users in table rows
2. Calls PATCH with `{ user_id, role }` when role dropdown changed
3. Calls PATCH with `{ user_id, is_active: false }` when Deactivate clicked
4. Calls PATCH with `{ user_id, is_active: true }` when Reactivate clicked
5. Deactivated user row has `opacity-50` class
6. Current user role select is disabled
7. Current user deactivate button is disabled
8. Role select shows updated value optimistically after change

### `src/components/__tests__/member-list.test.tsx` (6 tests)

Mock: `global.fetch = jest.fn()`, `jest.clearAllMocks()` in afterEach

1. Renders all members in table rows
2. Calls PATCH with `{ project_id, user_id, role }` when role dropdown changed (SA)
3. Calls DELETE with `{ project_id, user_id }` when Remove clicked (SA)
4. Member row disappears optimistically after Remove clicked
5. Role selects and Remove buttons not rendered for non-SA
6. Shows empty state when members array is empty
