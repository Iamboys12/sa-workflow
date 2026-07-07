import { render, screen } from '@testing-library/react'
import TaskItem from '../task-item'
import type { Task } from '@/lib/types'

const mockTask: Task = {
  id: 't1',
  project_step_id: 'ps1',
  title: 'Write tests',
  description: '',
  assigned_to: null,
  status: 'todo',
  due_date: null,
  created_by: 'u1',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const baseProps = {
  task: mockTask,
  isSA: false,
  canAssign: false,
  projectId: 'p1',
  currentUserId: 'u1',
  onUpdate: jest.fn(),
  onDelete: jest.fn(),
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve([]),
  } as Response)
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('TaskItem', () => {
  it('renders task title', () => {
    render(<TaskItem {...baseProps} />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
  })

  it('does not show assignee select or due date input when canAssign is false', () => {
    const { container } = render(<TaskItem {...baseProps} canAssign={false} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('shows assignee select and due date input when canAssign is true', () => {
    const { container } = render(<TaskItem {...baseProps} canAssign={true} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).not.toBeNull()
  })

  it('shows delete button only when isSA is true', () => {
    const { rerender } = render(<TaskItem {...baseProps} isSA={false} />)
    expect(screen.queryByText('×')).not.toBeInTheDocument()
    rerender(<TaskItem {...baseProps} isSA={true} />)
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('shows status toggle when task is assigned to currentUserId', () => {
    const assignedTask = { ...mockTask, assigned_to: 'u1' }
    render(<TaskItem {...baseProps} task={assignedTask} currentUserId="u1" isSA={false} />)
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })
})
