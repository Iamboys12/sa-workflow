/**
 * @jest-environment node
 */
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

const mockProjects = [
  { id: 'p1', name: 'MPAY Migration', description: '', status: 'active',
    created_by: 'u1', template_id: 't1', created_at: '2026-01-01' },
]

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({
        order: jest.fn().mockResolvedValue({ data: mockProjects, error: null }),
      }),
    }),
  }),
}))

describe('GET /api/projects', () => {
  it('returns projects for authenticated user', async () => {
    const req = new NextRequest('http://localhost/api/projects')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual(mockProjects)
  })
})

describe('POST /api/projects', () => {
  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ template_id: 't1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('name is required')
  })
})
