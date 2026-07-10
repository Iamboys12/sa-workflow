# Phase 8: Search & Filter Design

## Overview

Add a global search bar to the nav that searches across projects and tasks using Postgres ILIKE queries. Results appear in an inline dropdown. Task results can be filtered by status and assignee without leaving the current page.

## Scope

- **In:** keyword search across project names and task titles; filter tasks by status and assignee; inline dropdown results in nav
- **Out:** full-text search ranking, search history, comment/activity search, due date filter, dedicated /search page

## Architecture

Five files total: one API route, one client component, one nav modification, two test files.

```
SearchBar ('use client')
  ↓ debounce 300ms
GET /api/search?q=...&status=...&assignee=...
  ↓ two ILIKE queries (RLS enforced)
{ projects: [...], tasks: [...] }
  ↓
Dropdown (projects section + tasks section + filter pills)
```

## File Map

| Action | Path |
|--------|------|
| Create | `src/app/api/search/route.ts` |
| Create | `src/components/search-bar.tsx` |
| Modify | `src/components/nav.tsx` |
| Create | `src/components/__tests__/search-bar.test.tsx` |
| Create | `src/app/api/search/__tests__/route.test.ts` |

## API — GET /api/search

### Query Parameters

| Param | Required | Notes |
|-------|----------|-------|
| `q` | yes | min 2 chars; if shorter, return empty arrays immediately |
| `status` | no | `todo` \| `in_progress` \| `done` |
| `assignee` | no | user UUID |

### Queries

**Projects:**
```sql
select id, name, status
from projects
where name ilike '%{q}%'
limit 5
```

**Tasks** (with optional filters):
```sql
select t.id, t.title, t.status, t.assigned_to,
       p.name as project_name, ps.project_id
from tasks t
join project_steps ps on ps.id = t.project_step_id
join projects p on p.id = ps.project_id
where t.title ilike '%{q}%'
  [and t.status = '{status}']        -- if status param present
  [and t.assigned_to = '{assignee}'] -- if assignee param present
limit 5
```

RLS is active on all tables — SA sees everything, PM/TL see only their project members' data automatically.

### Response Shape

```typescript
{
  projects: { id: string; name: string; status: string }[]
  tasks: {
    id: string
    title: string
    status: string
    assigned_to: string | null
    project_name: string
    project_id: string
  }[]
}
```

### Error Handling

- No authenticated user → 401
- Supabase error → 500 with `{ error: message }`
- `q` < 2 chars → 200 with `{ projects: [], tasks: [] }`

## Component — SearchBar

**File:** `src/components/search-bar.tsx` (`'use client'`)

**Props:**
```typescript
interface SearchBarProps {
  currentUserId: string
}
```

**Behavior:**
- Input → debounce 300ms → fetch `/api/search?q=...`
- Fetch only when `q.trim().length >= 2`; clear results when `q` is shorter
- Dropdown visible when `q.trim().length >= 2`
- Loading state: show `"Searching..."` while fetch in flight
- Empty state: show `"No results for '{q}'"` when both arrays empty

**Dropdown layout:**
```
[ input field                    ]
[ Status: All ▾ ] [ Assignee: All ▾ ]  ← filter pills (shown when q ≥ 2)
─────────────────────────────────
Projects
  • Project Alpha          active
  • Project Beta          archived
─────────────────────────────────
Tasks
  • Fix login bug         todo   — Project Alpha
  • Write tests      in_progress — Project Beta
```

**Navigation on click:**
- Project row → `router.push('/projects/{id}')`
- Task row → `router.push('/projects/{project_id}')`
- Both close the dropdown after navigation

**Keyboard / close behavior:**
- Escape key → close dropdown, clear input
- Click outside → close dropdown (useEffect + `document.addEventListener('mousedown', ...)`)

**Assignee filter:** fetch `profiles` list once on mount (only when component renders) to populate the Assignee dropdown. Fetch only `id` and `full_name`.

## Nav Integration

**File:** `src/components/nav.tsx`

- Add `<SearchBar currentUserId={profile.id} />` between nav links and `<NotificationBell />`
- Render only when `profile` is non-null

## Tests

### Component — `search-bar.test.tsx`

Mocks:
- `next/navigation` → `useRouter` returns `{ push: jest.fn() }`
- `global.fetch = jest.fn()` in `beforeEach`; `jest.clearAllMocks()` in `afterEach`

Test cases (10):
1. Does not show dropdown when input is empty
2. Does not call fetch when query is fewer than 2 characters
3. Calls fetch with correct `q` param when query is ≥ 2 characters
4. Renders project results in dropdown
5. Renders task results in dropdown
6. Shows empty state when both arrays are empty
7. Navigates to `/projects/{id}` when a project result is clicked
8. Navigates to `/projects/{project_id}` when a task result is clicked
9. Calls fetch with `status=todo` query param when status filter is changed to Todo
10. Closes dropdown and clears input when Escape is pressed

### API Route — `route.test.ts`

Mocks: `createServerSupabase` (same pattern as notifications — `mockGetUser` + `mockFrom`).

Test cases (4):
1. Returns `{ projects: [], tasks: [] }` when `q` is fewer than 2 characters
2. Returns matching projects and tasks for a valid query
3. Applies `status` filter to tasks query
4. Returns 401 when not authenticated
