/**
 * @jest-environment node
 */
import { GET, POST, PATCH, DELETE } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockListUsers = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: jest.fn().mockReturnValue({
    auth: { admin: { listUsers: (...args: unknown[]) => mockListUsers(...args) } },
  }),
}))

function makeRequesterQuery(role = 'sa') {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role }, error: null }),
      }),
    }),
  }
}

function makeInsertQuery(data: unknown) {
  return {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function makeUpdateQuery(data: unknown) {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'sa-user' } } })
  mockListUsers.mockResolvedValue({
    data: { users: [{ id: 'invite-user', email: 'pm@test.com' }] },
    error: null,
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/members', () => {
  it('returns 400 when role is invalid', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
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
  it('updates member role and returns updated row', async () => {
    const updated = { project_id: 'p1', user_id: 'u2', role: 'tech_lead' }
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
            .mockImplementationOnce(() => makeUpdateQuery(updated))
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

  it('returns 400 for invalid role', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('sa'))
    const req = new NextRequest('http://localhost/api/members', {
      method: 'PATCH',
      body: JSON.stringify({ project_id: 'p1', user_id: 'u2', role: 'sa' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-SA', async () => {
    mockFrom.mockImplementationOnce(() => makeRequesterQuery('pm'))
    const req = new NextRequest('http://localhost/api/members', {
      method: 'PATCH',
      body: JSON.stringify({ project_id: 'p1', user_id: 'u2', role: 'pm' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })
})
