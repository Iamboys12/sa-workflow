import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationBell from '../notification-bell'
import type { Notification } from '@/lib/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockRemoveChannel = jest.fn()
const mockSubscribe = jest.fn()
const mockOn = jest.fn()
const mockChannel = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabase: () => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

const unread: Notification = {
  id: 'n1',
  user_id: 'u1',
  type: 'task_assigned',
  payload: { task_id: 't1', task_title: 'Fix bug', project_id: 'p1', step_id: 's1' },
  read: false,
  created_at: new Date().toISOString(),
}

const readComment: Notification = {
  id: 'n2',
  user_id: 'u1',
  type: 'comment_added',
  payload: { task_id: 't2', task_title: 'Review PR', project_id: 'p2', commenter_name: 'Alice' },
  read: true,
  created_at: new Date().toISOString(),
}

beforeEach(() => {
  mockOn.mockReturnValue({ subscribe: mockSubscribe })
  mockChannel.mockReturnValue({ on: mockOn })
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([unread, readComment]),
  } as Response)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('NotificationBell', () => {
  it('renders the bell button', () => {
    render(<NotificationBell userId="u1" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows unread badge count after notifications load', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('caps badge at 9+ when more than 9 notifications are unread', async () => {
    const many: Notification[] = Array.from({ length: 10 }, (_, i) => ({
      ...unread,
      id: `n${i}`,
    }))
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(many),
    } as Response)
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument()
    })
  })

  it('renders task_assigned message correctly', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('You were assigned to "Fix bug"')).toBeInTheDocument()
    })
  })

  it('renders comment_added message correctly', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => {
      expect(screen.getByText('Alice commented on "Review PR"')).toBeInTheDocument()
    })
  })

  it('calls PATCH /api/notifications when mark all as read is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('Mark all as read'))
    fireEvent.click(screen.getByText('Mark all as read'))
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications', { method: 'PATCH' })
  })

  it('calls PATCH /api/notifications/[id] and navigates when an unread item is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('You were assigned to "Fix bug"'))
    fireEvent.click(screen.getByText('You were assigned to "Fix bug"'))
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications/n1', { method: 'PATCH' })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/p1')
    })
  })

  it('does not call PATCH but still navigates when a read item is clicked', async () => {
    render(<NotificationBell userId="u1" />)
    await waitFor(() => screen.getByText('Alice commented on "Review PR"'))
    fireEvent.click(screen.getByText('Alice commented on "Review PR"'))
    const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, opts]: [string, RequestInit]) =>
        url === '/api/notifications/n2' && opts?.method === 'PATCH'
    )
    expect(patchCalls).toHaveLength(0)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/p2')
    })
  })
})
