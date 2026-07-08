/**
 * @jest-environment node
 */
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

beforeEach(() => { mockFrom.mockReset() })

const ctx = { params: { id: 't1' } }

const sampleEvents = [{
  id: 'ev1', task_id: 't1', user_id: 'u1', type: 'comment',
  body: 'Hello', meta: null, created_at: '2026-07-08T10:00:00Z',
  author: { full_name: 'Alice' },
}]

function setupMocks({ role = 'sa', isMember = true, events = sampleEvents } = {}) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tasks') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({
        data: { project_step_id: 'ps1', project_steps: { project_id: 'p1' } },
      }) }) }),
    }
    if (table === 'profiles') return {
      select: () => ({
        eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role, full_name: 'Alice' } }) }),
        in: jest.fn().mockResolvedValue({ data: [] }),
      }),
    }
    if (table === 'project_members') return {
      select: () => ({ eq: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({
        data: isMember ? { user_id: 'u1' } : null,
      }) }) }) }),
    }
    if (table === 'task_events') return {
      select: () => ({ eq: () => ({ order: jest.fn().mockResolvedValue({ data: events, error: null }) }) }),
      insert: () => ({ select: () => ({ single: jest.fn().mockResolvedValue({
        data: { id: 'ev2', task_id: 't1', user_id: 'u1', type: 'comment', body: 'New comment', meta: null, created_at: '2026-07-08T11:00:00Z' },
        error: null,
      }) }) }),
    }
    return {}
  })
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/t1/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET /api/tasks/[id]/events', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(new NextRequest('http://localhost'), ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is not a project member', async () => {
    setupMocks({ role: 'pm', isMember: false })
    const res = await GET(new NextRequest('http://localhost'), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 200 with shaped events for project member', async () => {
    setupMocks({ role: 'pm', isMember: true })
    const res = await GET(new NextRequest('http://localhost'), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({ id: 'ev1', user_name: 'Alice', type: 'comment', body: 'Hello' })
  })

  it('returns 200 for SA regardless of membership', async () => {
    setupMocks({ role: 'sa' })
    const res = await GET(new NextRequest('http://localhost'), ctx)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/tasks/[id]/events', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ body: 'hello' }), ctx)
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is empty', async () => {
    setupMocks({ role: 'sa' })
    const res = await POST(makeReq({ body: '   ' }), ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body field is missing', async () => {
    setupMocks({ role: 'sa' })
    const res = await POST(makeReq({}), ctx)
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller is not a project member', async () => {
    setupMocks({ role: 'pm', isMember: false })
    const res = await POST(makeReq({ body: 'hello' }), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 201 with created event for valid comment', async () => {
    setupMocks({ role: 'sa' })
    const res = await POST(makeReq({ body: 'New comment' }), ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ id: 'ev2', type: 'comment' })
  })
})

import { DELETE } from '../[eventId]/route'

const eventCtx = { params: { id: 't1', eventId: 'ev1' } }

function setupDeleteMocks({ role = 'sa', eventOwnerId = 'u1', eventType = 'comment' } = {}) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return {
      select: () => ({
        eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role, full_name: 'Alice' } }) }),
        in: jest.fn().mockResolvedValue({ data: [] }),
      }),
    }
    if (table === 'task_events') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({
        data: { id: 'ev1', user_id: eventOwnerId, type: eventType },
      }) }) }),
      delete: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    }
    return {}
  })
}

describe('DELETE /api/tasks/[id]/events/[eventId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(401)
  })

  it('returns 404 when event not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa', full_name: 'Alice' } }) }) }),
      }
      if (table === 'task_events') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: null }) }) }),
        delete: () => ({ eq: jest.fn() }),
      }
      return {}
    })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(404)
  })

  it('returns 403 when event type is not comment', async () => {
    setupDeleteMocks({ role: 'sa', eventType: 'status_change' })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(403)
  })

  it('returns 403 when caller is not owner and not SA', async () => {
    setupDeleteMocks({ role: 'pm', eventOwnerId: 'u2' })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(403)
  })

  it('returns 200 when owner deletes own comment', async () => {
    setupDeleteMocks({ role: 'pm', eventOwnerId: 'u1' })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(200)
  })

  it('returns 200 when SA deletes any comment', async () => {
    setupDeleteMocks({ role: 'sa', eventOwnerId: 'u2' })
    const res = await DELETE(new NextRequest('http://localhost'), eventCtx)
    expect(res.status).toBe(200)
  })
})
