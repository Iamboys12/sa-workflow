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

const ctx = { params: { id: 'p1', stepId: 'step1' } }

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
    }
    if (table === 'project_steps') return {
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: { id: 'step1', status: 'in_progress' }, error: null }),
          }),
        }),
      }),
    }
    return {}
  })
})

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/projects/p1/steps/step1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/projects/[id]/steps/[stepId]', () => {
  it('returns 403 when user is not SA', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'pm' } }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ status: 'in_progress' }), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 400 when status is invalid', async () => {
    const res = await PATCH(makeReq({ status: 'unknown' }), ctx)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid status')
  })

  it('returns 200 with updated step on valid request', async () => {
    const res = await PATCH(makeReq({ status: 'in_progress' }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('in_progress')
  })
})
