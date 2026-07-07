/**
 * @jest-environment node
 */
import { GET } from '../route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const rawRow = {
  id: 't1',
  title: 'Fix auth bug',
  status: 'todo',
  due_date: '2026-07-10',
  project_step_id: 'ps1',
  step: {
    project_id: 'p1',
    order: 2,
    project: { name: 'Project Alpha' },
    template_step: { title: 'Code Review', order: 2 },
  },
}

const rawRowNoTemplate = {
  ...rawRow,
  id: 't2',
  step: { ...rawRow.step, template_step: null },
}

function setupMocks({ user = { id: 'u1' }, rows = [rawRow] } = {}) {
  mockGetUser.mockResolvedValue({ data: { user } })
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        order: () => ({
          order: jest.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    }),
  })
}

describe('GET /api/my-tasks', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns tasks shaped for My Tasks page', async () => {
    setupMocks()
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({
      id: 't1',
      title: 'Fix auth bug',
      status: 'todo',
      due_date: '2026-07-10',
      project_id: 'p1',
      project_name: 'Project Alpha',
      step_title: 'Code Review',
      step_order: 2,
    })
  })

  it('falls back to "Step N" when template_step is null', async () => {
    setupMocks({ rows: [rawRowNoTemplate] })
    const res = await GET()
    const json = await res.json()
    expect(json[0].step_title).toBe('Step 2')
  })
})
