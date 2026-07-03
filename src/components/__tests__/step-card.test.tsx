import { render, screen } from '@testing-library/react'
import StepCard from '../step-card'
import type { ProjectStep } from '@/lib/types'

const mockStep: ProjectStep = {
  id: 'step1', project_id: 'p1', template_step_id: 'ts1',
  status: 'in_progress', order: 3, updated_at: '2026-01-01',
  template_step: {
    id: 'ts1', template_id: 't1', order: 3,
    title: 'Code Scan', collaboration_model: 'ai-assisted', deliverables: [],
  },
  task_count: 4, done_count: 1,
}

describe('StepCard', () => {
  it('renders step number, title, and progress', () => {
    render(<StepCard step={mockStep} projectId="p1" />)
    expect(screen.getByText('Step 3')).toBeInTheDocument()
    expect(screen.getByText('Code Scan')).toBeInTheDocument()
    expect(screen.getByText('1 / 4 tasks')).toBeInTheDocument()
  })

  it('shows collaboration model badge', () => {
    render(<StepCard step={mockStep} projectId="p1" />)
    expect(screen.getByText('ai-assisted')).toBeInTheDocument()
  })

  it('shows correct status indicator for done step', () => {
    const doneStep = { ...mockStep, status: 'done' as const }
    render(<StepCard step={doneStep} projectId="p1" />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
