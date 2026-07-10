import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SearchBar from '../search-bar'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSupabaseFrom = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabase: () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  }),
}))

const mockSearchResults = {
  projects: [{ id: 'p1', name: 'Alpha Project', status: 'active' }],
  tasks: [{
    id: 't1', title: 'Fix login bug', status: 'todo',
    assigned_to: 'u1', project_name: 'Alpha Project', project_id: 'p1',
  }],
}

beforeEach(() => {
  jest.useFakeTimers()
  mockSupabaseFrom.mockReturnValue({
    select: () => ({
      order: () => Promise.resolve({ data: [{ id: 'u1', full_name: 'Alice' }], error: null }),
    }),
  })
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockSearchResults),
  } as Response)
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

describe('SearchBar', () => {
  it('does not show dropdown when input is empty', () => {
    render(<SearchBar currentUserId="u1" />)
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument()
  })

  it('does not call fetch when query is fewer than 2 characters', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'a' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls fetch with correct q param when query is ≥ 2 characters', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'fix' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=fix'))
    })
  })

  it('renders project results in dropdown', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'alpha' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => {
      expect(screen.getByTestId('project-result-p1')).toBeInTheDocument()
    })
    expect(screen.getByText('Alpha Project')).toBeInTheDocument()
  })

  it('renders task results in dropdown', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'fix' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => {
      expect(screen.getByTestId('task-result-t1')).toBeInTheDocument()
    })
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })

  it('shows empty state when no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [], tasks: [] }),
    } as Response)
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'xyz' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument()
    })
  })

  it('navigates to /projects/[id] when a project result is clicked', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'alpha' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => screen.getByTestId('project-result-p1'))
    fireEvent.click(screen.getByTestId('project-result-p1'))
    expect(mockPush).toHaveBeenCalledWith('/projects/p1')
  })

  it('navigates to /projects/[project_id] when a task result is clicked', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'fix' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => screen.getByTestId('task-result-t1'))
    fireEvent.click(screen.getByTestId('task-result-t1'))
    expect(mockPush).toHaveBeenCalledWith('/projects/p1')
  })

  it('calls fetch with status=todo when status filter is changed to Todo', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'fix' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => screen.getByTestId('status-filter'))
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'todo' } })
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const lastUrl = calls[calls.length - 1][0] as string
      expect(lastUrl).toContain('status=todo')
    })
  })

  it('closes dropdown and clears input when Escape is pressed', async () => {
    render(<SearchBar currentUserId="u1" />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'fix' } })
    await act(async () => { jest.advanceTimersByTime(300) })
    await waitFor(() => screen.getByTestId('search-dropdown'))
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Escape' })
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toHaveValue('')
  })
})
