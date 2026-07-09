import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('submits comment via POST and clears the input', async () => {
    render(<TaskDetailModal {...baseProps} />)
    await screen.findByText('Hello world')

    const input = screen.getByPlaceholderText('พิมพ์ comment...')
    fireEvent.change(input, { target: { value: 'New comment' } })
    fireEvent.submit(input.closest('form')!)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks/t1/events',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'New comment' }) })
    )
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
  })

  it('deletes comment via DELETE and removes it from the list', async () => {
    render(<TaskDetailModal {...baseProps} currentUserId="u1" />)
    const deleteBtn = await screen.findByTestId('delete-e1')

    fireEvent.click(deleteBtn)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks/t1/events/e1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
