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

function makeRequesterQuery(role = 'sa') {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role }, error: null }),
      }),
    }),
  }
}

function makeUsersQuery(users: unknown[]) {
  return {
    select: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: users, error: null }),
    }),
  }
}

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

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(401)
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

  it('reactivates user — calls adminUpdate with ban_duration none', async () => {
    const updated = { id: 'u2', full_name: 'Bob', role: 'pm', is_active: true }
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
            .mockImplementationOnce(() => makeUpdateQuery(updated))
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'u2', is_active: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockAdminUpdate).toHaveBeenCalledWith('u2', { ban_duration: 'none' })
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
