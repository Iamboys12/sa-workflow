/**
 * @jest-environment node
 */
import { PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockFrom = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const ctx = { params: { id: 'p1' } }

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
    }
    if (table === 'projects') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { created_by: 'u1', status: 'active' } }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: jest.fn().mockResolvedValue({ data: { id: 'p1', status: 'completed' }, error: null }) }) }) }),
    }
    return {}
  })
})

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/projects/p1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/projects/[id]', () => {
  it('returns 403 when user is not SA', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'pm' } }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ status: 'completed' }), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is not the project creator', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
      }
      if (table === 'projects') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { created_by: 'other-user', status: 'active' } }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ status: 'completed' }), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 400 when transition is invalid', async () => {
    const res = await PATCH(makeReq({ status: 'active' }), ctx)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Cannot transition/)
  })

  it('returns 200 with updated project on valid transition', async () => {
    const res = await PATCH(makeReq({ status: 'completed' }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('completed')
  })
})
