/**
 * @jest-environment node
 */
import { GET } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

function makeQuery(data: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data, error: null }),
  }
}

const sampleProjects = [{ id: 'p1', name: 'Alpha Project', status: 'active' }]
const sampleTaskRows = [
  {
    id: 't1', title: 'Fix login bug', status: 'todo', assigned_to: 'u1',
    step: { project_id: 'p1', project: { name: 'Alpha Project' } },
  },
]

beforeEach(() => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/search', () => {
  it('returns empty arrays when q is fewer than 2 characters', async () => {
    const req = new NextRequest('http://localhost/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ projects: [], tasks: [] })
  })

  it('returns matching projects and tasks for a valid query', async () => {
    const projectQuery = makeQuery(sampleProjects)
    const taskQuery = makeQuery(sampleTaskRows)
    mockFrom.mockImplementationOnce(() => projectQuery)
            .mockImplementationOnce(() => taskQuery)
    const req = new NextRequest('http://localhost/api/search?q=fix')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.projects).toHaveLength(1)
    expect(json.tasks).toHaveLength(1)
    expect(json.tasks[0].project_name).toBe('Alpha Project')
    expect(json.tasks[0].project_id).toBe('p1')
  })

  it('applies status filter to tasks query', async () => {
    const projectQuery = makeQuery([])
    const taskQuery = makeQuery([])
    mockFrom.mockImplementationOnce(() => projectQuery)
            .mockImplementationOnce(() => taskQuery)
    const req = new NextRequest('http://localhost/api/search?q=fix&status=todo')
    await GET(req)
    expect(taskQuery.eq).toHaveBeenCalledWith('status', 'todo')
  })

  it('applies assignee filter to tasks query', async () => {
    const projectQuery = makeQuery([])
    const taskQuery = makeQuery([])
    mockFrom.mockImplementationOnce(() => projectQuery)
            .mockImplementationOnce(() => taskQuery)
    const req = new NextRequest('http://localhost/api/search?q=fix&assignee=u1')
    await GET(req)
    expect(taskQuery.eq).toHaveBeenCalledWith('assigned_to', 'u1')
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = new NextRequest('http://localhost/api/search?q=fix')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
