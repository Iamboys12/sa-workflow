import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserList from '../user-list'
import type { Profile } from '@/lib/types'

const activeUser: Profile = {
  id: 'u1', full_name: 'Alice', role: 'sa', is_active: true, created_at: '2026-01-01',
}
const deactivatedUser: Profile = {
  id: 'u2', full_name: 'Bob', role: 'pm', is_active: false, created_at: '2026-01-01',
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('UserList', () => {
  it('renders all users in table rows', () => {
    render(<UserList users={[activeUser, deactivatedUser]} currentUserId="current" />)
    expect(screen.getByTestId('user-row-u1')).toBeInTheDocument()
    expect(screen.getByTestId('user-row-u2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls PATCH with { user_id, role } when role dropdown changed', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.change(screen.getByTestId('role-select-u1'), { target: { value: 'pm' } })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u1', role: 'pm' }),
      }))
    })
  })

  it('calls PATCH with { user_id, is_active: false } when Deactivate clicked', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.click(screen.getByTestId('deactivate-btn-u1'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u1', is_active: false }),
      }))
    })
  })

  it('calls PATCH with { user_id, is_active: true } when Reactivate clicked', async () => {
    render(<UserList users={[deactivatedUser]} currentUserId="current" />)
    fireEvent.click(screen.getByTestId('deactivate-btn-u2'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ user_id: 'u2', is_active: true }),
      }))
    })
  })

  it('deactivated user row has opacity-50 class', () => {
    render(<UserList users={[deactivatedUser]} currentUserId="current" />)
    expect(screen.getByTestId('user-row-u2')).toHaveClass('opacity-50')
  })

  it('current user role select is disabled', () => {
    render(<UserList users={[activeUser]} currentUserId="u1" />)
    expect(screen.getByTestId('role-select-u1')).toBeDisabled()
  })

  it('current user deactivate button is disabled', () => {
    render(<UserList users={[activeUser]} currentUserId="u1" />)
    expect(screen.getByTestId('deactivate-btn-u1')).toBeDisabled()
  })

  it('role select shows updated value optimistically after change', async () => {
    render(<UserList users={[activeUser]} currentUserId="current" />)
    fireEvent.change(screen.getByTestId('role-select-u1'), { target: { value: 'pm' } })
    await waitFor(() => {
      expect(screen.getByTestId('role-select-u1')).toHaveValue('pm')
    })
  })
})
