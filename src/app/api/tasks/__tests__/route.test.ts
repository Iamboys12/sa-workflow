/**
 * @jest-environment node
 */
import { POST } from '../route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: jest.fn().mockResolvedValue({ data: { role: 'sa' } }) }) }),
      insert: () => ({ select: () => ({ single: jest.fn().mockResolvedValue({
        data: { id: 't1', title: 'Write failing test', status: 'todo' },
        error: null,
      }) }) }),
    }),
  }),
}))

describe('POST /api/tasks', () => {
  it('returns 400 when title is missing', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ project_step_id: 'step1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('title is required')
  })

  it('creates task and returns 201', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ project_step_id: 'step1', title: 'Write failing test' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.title).toBe('Write failing test')
  })
})
