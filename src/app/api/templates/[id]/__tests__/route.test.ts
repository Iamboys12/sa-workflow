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

const ctx = { params: { id: 'tmpl1' } }

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
    }
    if (table === 'workflow_templates') return {
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { is_default: false } }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
    if (table === 'workflow_template_steps') return {
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }
    return {}
  })
})

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/templates/tmpl1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/templates/[id]', () => {
  it('returns 403 when user is not SA', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'pm' } }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ name: 'X' }), ctx)
    expect(res.status).toBe(403)
  })

  it('returns 400 when template is default', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
      }
      if (table === 'workflow_templates') return {
        select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { is_default: true } }) }) }),
      }
      return {}
    })
    const res = await PATCH(makeReq({ name: 'X' }), ctx)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/default/)
  })

  it('returns 200 with name-only update', async () => {
    const res = await PATCH(makeReq({ name: 'Updated Name' }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 200 with name + steps update', async () => {
    const res = await PATCH(makeReq({
      name: 'Updated',
      steps: [{ title: 'Step A', collaboration_model: 'human-led', deliverables: ['Doc'] }],
    }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
