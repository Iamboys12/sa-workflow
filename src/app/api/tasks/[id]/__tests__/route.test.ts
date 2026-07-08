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

beforeEach(() => { mockFrom.mockReset() })

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

  it('returns 404 when task is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tasks') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: null }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ status: 'done' }), ctx)
    expect(res.status).toBe(404)
  })
})
