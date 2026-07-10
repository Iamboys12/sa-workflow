import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemberList from '../member-list'

global.fetch = jest.fn()

const members = [
  { user_id: 'u1', role: 'pm' as const, profile: { id: 'u1', full_name: 'Alice' } },
  { user_id: 'u2', role: 'tech_lead' as const, profile: { id: 'u2', full_name: 'Bob' } },
]

beforeEach(() => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('MemberList', () => {
  it('renders all members', () => {
    render(<MemberList members={members} projectId="p1" />)
    expect(screen.getByTestId('member-list')).toBeInTheDocument()
    expect(screen.getByTestId('member-row-u1')).toBeInTheDocument()
    expect(screen.getByTestId('member-row-u2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows role selects with current values', () => {
    render(<MemberList members={members} projectId="p1" />)
    expect((screen.getByTestId('role-select-u1') as HTMLSelectElement).value).toBe('pm')
    expect((screen.getByTestId('role-select-u2') as HTMLSelectElement).value).toBe('tech_lead')
  })

  it('calls PATCH on role change with optimistic update', async () => {
    render(<MemberList members={members} projectId="p1" />)
    fireEvent.change(screen.getByTestId('role-select-u1'), { target: { value: 'tech_lead' } })
    expect((screen.getByTestId('role-select-u1') as HTMLSelectElement).value).toBe('tech_lead')
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/members', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ project_id: 'p1', user_id: 'u1', role: 'tech_lead' }),
      }))
    })
  })

  it('removes member on Remove click with optimistic update', async () => {
    render(<MemberList members={members} projectId="p1" />)
    fireEvent.click(screen.getByTestId('remove-btn-u1'))
    expect(screen.queryByTestId('member-row-u1')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/members', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ project_id: 'p1', user_id: 'u1' }),
      }))
    })
  })

  it('shows remove buttons for all members', () => {
    render(<MemberList members={members} projectId="p1" />)
    expect(screen.getByTestId('remove-btn-u1')).toBeInTheDocument()
    expect(screen.getByTestId('remove-btn-u2')).toBeInTheDocument()
  })

  it('renders empty table when no members', () => {
    render(<MemberList members={[]} projectId="p1" />)
    expect(screen.getByTestId('member-list')).toBeInTheDocument()
    expect(screen.queryByTestId('member-row-u1')).not.toBeInTheDocument()
  })
})
