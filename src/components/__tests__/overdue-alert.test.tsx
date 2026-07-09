import { render, screen } from '@testing-library/react'
import OverdueAlert from '../overdue-alert'

const makeTask = (i: number) => ({
  id: `t${i}`,
  title: `Task ${i}`,
  due_date: '2026-07-01',
  assignee_name: 'Alice',
  project_name: 'Project A',
})

describe('OverdueAlert', () => {
  it('renders nothing when tasks array is empty', () => {
    const { container } = render(<OverdueAlert tasks={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows overdue count in heading', () => {
    render(<OverdueAlert tasks={[makeTask(0), makeTask(1), makeTask(2)]} />)
    expect(screen.getByText(/3 overdue tasks/i)).toBeInTheDocument()
  })

  it('renders task title and due date', () => {
    render(<OverdueAlert tasks={[makeTask(0)]} />)
    expect(screen.getByText(/Task 0/)).toBeInTheDocument()
    expect(screen.getByText(/2026-07-01/)).toBeInTheDocument()
  })

  it('renders all tasks when 5 or fewer without a details element', () => {
    const { container } = render(<OverdueAlert tasks={Array.from({ length: 5 }, (_, i) => makeTask(i))} />)
    expect(container.querySelector('details')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('shows summary with remaining count when more than 5 tasks', () => {
    render(<OverdueAlert tasks={Array.from({ length: 8 }, (_, i) => makeTask(i))} />)
    expect(screen.getByText(/3 more/i)).toBeInTheDocument()
  })
})
