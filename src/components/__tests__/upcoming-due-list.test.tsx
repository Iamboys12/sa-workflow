import { render, screen } from '@testing-library/react'
import UpcomingDueList from '../upcoming-due-list'

const tasks = [
  { id: 't1', title: 'Overdue task', status: 'todo', due_date: '2026-07-01', project_name: 'Proj A', is_overdue: true },
  { id: 't2', title: 'Upcoming task', status: 'in_progress', due_date: '2026-07-15', project_name: 'Proj B', is_overdue: false },
]

describe('UpcomingDueList', () => {
  it('renders empty state when tasks array is empty', () => {
    render(<UpcomingDueList tasks={[]} />)
    expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument()
  })

  it('renders all task titles', () => {
    render(<UpcomingDueList tasks={tasks} />)
    expect(screen.getByText('Overdue task')).toBeInTheDocument()
    expect(screen.getByText('Upcoming task')).toBeInTheDocument()
  })

  it('applies red styling to overdue tasks', () => {
    render(<UpcomingDueList tasks={tasks} />)
    const overdueRow = screen.getByTestId('due-task-t1')
    expect(overdueRow.className).toMatch(/red/)
  })

  it('does not apply red styling to non-overdue tasks', () => {
    render(<UpcomingDueList tasks={tasks} />)
    const normalRow = screen.getByTestId('due-task-t2')
    expect(normalRow.className).not.toMatch(/red/)
  })
})
