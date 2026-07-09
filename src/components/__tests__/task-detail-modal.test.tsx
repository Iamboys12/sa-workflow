import { render, screen } from '@testing-library/react'
import TaskDetailModal from '../task-detail-modal'

const mockEvents = [
  {
    id: 'e1', task_id: 't1', user_id: 'u1', user_name: 'Alice',
    type: 'comment', body: 'Hello world', meta: null,
    created_at: '2026-07-08T10:00:00Z',
  },
  {
    id: 'e2', task_id: 't1', user_id: 'u2', user_name: 'Bob',
    type: 'status_change', body: null,
    meta: { from: 'todo', to: 'in_progress' },
    created_at: '2026-07-08T10:01:00Z',
  },
]

jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabase: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  })),
}))

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockEvents),
  } as Response)
  window.HTMLElement.prototype.scrollIntoView = jest.fn()
})

afterEach(() => { jest.clearAllMocks() })

const baseProps = {
  taskId: 't1',
  taskTitle: 'Write tests',
  currentUserId: 'u1',
  isSA: false,
  onClose: jest.fn(),
}

describe('TaskDetailModal', () => {
  it('renders comment body', async () => {
    render(<TaskDetailModal {...baseProps} />)
    expect(await screen.findByText('Hello world')).toBeInTheDocument()
  })

  it('renders activity event text', async () => {
    render(<TaskDetailModal {...baseProps} />)
    expect(await screen.findByText(/todo → in_progress/)).toBeInTheDocument()
  })

  it('shows delete button for own comment', async () => {
    render(<TaskDetailModal {...baseProps} currentUserId="u1" />)
    expect(await screen.findByTestId('delete-e1')).toBeInTheDocument()
  })

  it('hides delete button for another user comment', async () => {
    render(<TaskDetailModal {...baseProps} currentUserId="u2" />)
    await screen.findByText('Hello world')
    expect(screen.queryByTestId('delete-e1')).not.toBeInTheDocument()
  })

  it('SA sees delete button on any comment', async () => {
    render(<TaskDetailModal {...baseProps} currentUserId="u2" isSA={true} />)
    expect(await screen.findByTestId('delete-e1')).toBeInTheDocument()
  })
})
