/**
 * @jest-environment node
 */
import { GET, PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockFrom = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const sampleNotifications = [
  { id: 'n1', user_id: 'u1', type: 'task_assigned', payload: { task_title: 'T1', project_id: 'p1', task_id: 'tk1', step_id: 's1' }, read: false, created_at: '2026-07-06T00:00:00Z' },
]

describe('GET /api/notifications', () => {
  it('returns notifications for current user', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: jest.fn().mockResolvedValue({ data: sampleNotifications, error: null }),
          }),
        }),
      }),
    }))
    const req = new NextRequest('http://localhost/api/notifications')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].type).toBe('task_assigned')
  })
})

describe('PATCH /api/notifications', () => {
  it('marks all notifications as read', async () => {
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }))
    const req = new NextRequest('http://localhost/api/notifications', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
