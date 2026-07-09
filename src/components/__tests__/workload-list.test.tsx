import { render, screen } from '@testing-library/react'
import WorkloadList from '../workload-list'

const entries = [
  { user_id: 'u1', name: 'Alice', todo: 2, in_progress: 3, total: 5 },
  { user_id: null, name: '(Unassigned)', todo: 4, in_progress: 0, total: 4 },
  { user_id: 'u2', name: 'Bob', todo: 0, in_progress: 1, total: 1 },
]

describe('WorkloadList', () => {
  it('renders all member names', () => {
    render(<WorkloadList entries={entries} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('(Unassigned)')).toBeInTheDocument()
  })

  it('shows correct todo, in_progress, total counts for a member', () => {
    render(<WorkloadList entries={entries} />)
    expect(screen.getByTestId('todo-u1')).toHaveTextContent('2')
    expect(screen.getByTestId('inprogress-u1')).toHaveTextContent('3')
    expect(screen.getByTestId('total-u1')).toHaveTextContent('5')
  })

  it('uses "unassigned" as key for null user_id row', () => {
    render(<WorkloadList entries={entries} />)
    expect(screen.getByTestId('todo-unassigned')).toHaveTextContent('4')
  })

  it('renders empty state message when entries array is empty', () => {
    render(<WorkloadList entries={[]} />)
    expect(screen.getByText(/no tasks assigned/i)).toBeInTheDocument()
  })
})
