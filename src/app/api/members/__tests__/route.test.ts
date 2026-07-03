/**
 * @jest-environment node
 */
import { POST } from '../route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'sa-user' } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: table === 'profiles' ? { role: 'sa' } : { id: 'invite-user' },
            error: null,
          }),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'invite-user' }, error: null }),
        }),
      }),
      insert: () => ({ select: () => ({ single: jest.fn().mockResolvedValue({
        data: { project_id: 'p1', user_id: 'invite-user', role: 'pm' }, error: null,
      }) }) }),
    }),
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: jest.fn().mockReturnValue({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({
          data: { users: [{ id: 'invite-user', email: 'pm@test.com' }] },
          error: null,
        }),
      },
    },
  }),
}))

describe('POST /api/members', () => {
  it('returns 400 when role is invalid', async () => {
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
