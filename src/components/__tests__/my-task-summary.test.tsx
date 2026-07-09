import { render, screen } from '@testing-library/react'
import MyTaskSummary from '../my-task-summary'

describe('MyTaskSummary', () => {
  it('renders todo, inProgress, done counts', () => {
    render(<MyTaskSummary todo={3} inProgress={2} done={5} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders a link to /my-tasks labelled "View all"', () => {
    render(<MyTaskSummary todo={0} inProgress={0} done={0} />)
    const link = screen.getByRole('link', { name: /view all/i })
    expect(link).toHaveAttribute('href', '/my-tasks')
  })
})
