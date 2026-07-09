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
