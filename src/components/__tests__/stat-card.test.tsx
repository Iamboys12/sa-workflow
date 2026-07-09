import { render, screen } from '@testing-library/react'
import StatCard from '../stat-card'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Active Projects" value={5} />)
    expect(screen.getByText('Active Projects')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('applies red text class when color is red', () => {
    render(<StatCard label="Overdue" value={3} color="red" />)
    const value = screen.getByTestId('stat-value')
    expect(value.className).toMatch(/red/)
  })

  it('applies green text class when color is green', () => {
    render(<StatCard label="Overdue" value={0} color="green" />)
    const value = screen.getByTestId('stat-value')
    expect(value.className).toMatch(/green/)
  })

  it('uses neutral (gray) text by default', () => {
    render(<StatCard label="Members" value={10} />)
    const value = screen.getByTestId('stat-value')
    expect(value.className).toMatch(/gray/)
  })
})
