import { render, screen } from '@testing-library/react'
import ProjectProgressCard from '../project-progress-card'

const base = {
  id: 'p1',
  name: 'Test Project',
  status: 'active',
  step_count: 10,
  done_steps: 6,
  blocked_steps: 0,
}

describe('ProjectProgressCard', () => {
  it('renders the project name', () => {
    render(<ProjectProgressCard project={base} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('shows the correct progress fraction label', () => {
    render(<ProjectProgressCard project={base} />)
    expect(screen.getByText('6/10 steps done')).toBeInTheDocument()
  })

  it('sets progress bar width to correct percentage', () => {
    const { container } = render(<ProjectProgressCard project={base} />)
    const bar = container.querySelector('[data-testid="progress-bar"]') as HTMLElement
    expect(bar.style.width).toBe('60%')
  })

  it('shows blocked badge when blocked_steps > 0', () => {
    render(<ProjectProgressCard project={{ ...base, blocked_steps: 2 }} />)
    expect(screen.getByText(/blocked/i)).toBeInTheDocument()
  })

  it('hides blocked badge when blocked_steps is 0', () => {
    render(<ProjectProgressCard project={base} />)
    expect(screen.queryByText(/blocked/i)).not.toBeInTheDocument()
  })

  it('links to the project page', () => {
    render(<ProjectProgressCard project={base} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/projects/p1')
  })

  it('shows 0% progress when step_count is 0', () => {
    const { container } = render(<ProjectProgressCard project={{ ...base, step_count: 0, done_steps: 0 }} />)
    const bar = container.querySelector('[data-testid="progress-bar"]') as HTMLElement
    expect(bar.style.width).toBe('0%')
  })
})
