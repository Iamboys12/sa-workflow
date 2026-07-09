import { render, screen, fireEvent } from '@testing-library/react'
import MyTaskList, { type TaskRow } from '../my-task-list'

jest.mock('../task-detail-modal', () => ({
  __esModule: true,
  default: ({ taskId, onClose }: { taskId: string; onClose: () => void }) => (
    <div data-testid={`modal-${taskId}`}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

const baseTasks: TaskRow[] = [
  {
    id: 't1', title: 'Write tests', status: 'todo', due_date: null,
    project_step_id: 'ps1', project_id: 'p1', project_name: 'Project A', step_title: 'Step 1',
  },
  {
    id: 't2', title: 'Review PR', status: 'in_progress', due_date: '2026-07-15',
    project_step_id: 'ps2', project_id: 'p1', project_name: 'Project A', step_title: 'Step 2',
  },
  {
    id: 't3', title: 'Deploy', status: 'done', due_date: '2026-07-10',
    project_step_id: 'ps3', project_id: 'p2', project_name: 'Project B', step_title: 'Step 1',
  },
]

const baseProps = { tasks: baseTasks, currentUserId: 'u1', isSA: false }

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)
})
afterEach(() => { jest.clearAllMocks() })

describe('MyTaskList', () => {
  it('renders all task titles on the All tab by default', () => {
    render(<MyTaskList {...baseProps} />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('Review PR')).toBeInTheDocument()
    expect(screen.getByText('Deploy')).toBeInTheDocument()
  })

  it('filters to only todo tasks when Todo tab is clicked', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByTestId('filter-todo'))
    expect(screen.getByText('Write tests')).toBeInTheDocument()
    expect(screen.queryByText('Review PR')).not.toBeInTheDocument()
    expect(screen.queryByText('Deploy')).not.toBeInTheDocument()
  })

  it('filters to only done tasks when Done tab is clicked', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByTestId('filter-done'))
    expect(screen.getByText('Deploy')).toBeInTheDocument()
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument()
    expect(screen.queryByText('Review PR')).not.toBeInTheDocument()
  })

  it('shows per-tab empty state when filtered results are empty', () => {
    const noDonetasks = baseTasks.filter(t => t.status !== 'done')
    render(<MyTaskList tasks={noDonetasks} currentUserId="u1" isSA={false} />)
    fireEvent.click(screen.getByTestId('filter-done'))
    expect(screen.getByText(/no done tasks/i)).toBeInTheDocument()
  })

  it('shows global empty state on All tab when no tasks at all', () => {
    render(<MyTaskList tasks={[]} currentUserId="u1" isSA={false} />)
    expect(screen.getByText(/no tasks assigned to you yet/i)).toBeInTheDocument()
  })

  it('calls PATCH with correct status when a non-current status chip is clicked', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByTestId('status-t1-done'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks/t1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      })
    )
  })

  it('does not call PATCH when the current status chip is clicked', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByTestId('status-t1-todo'))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('applies active styling to the new status chip immediately (optimistic)', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByTestId('status-t1-in_progress'))
    expect(screen.getByTestId('status-t1-in_progress').className).toMatch(/blue/)
  })

  it('opens TaskDetailModal with correct taskId when title is clicked', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByText('Write tests'))
    expect(screen.getByTestId('modal-t1')).toBeInTheDocument()
  })

  it('closes TaskDetailModal when onClose is called', () => {
    render(<MyTaskList {...baseProps} />)
    fireEvent.click(screen.getByText('Write tests'))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('modal-t1')).not.toBeInTheDocument()
  })

  it('shows red due date styling for overdue non-done tasks', () => {
    const overdue: TaskRow = { ...baseTasks[0], due_date: '2026-01-01', status: 'todo' }
    render(<MyTaskList tasks={[overdue]} currentUserId="u1" isSA={false} />)
    expect(screen.getByText(/Due 2026-01-01/).className).toMatch(/red/)
  })
})
