'use client'

import { useQuery } from '@tanstack/react-query'
import StepCard from './step-card'
import type { ProjectStep } from '@/lib/types'

async function fetchSteps(projectId: string): Promise<ProjectStep[]> {
  const res = await fetch(`/api/projects/${projectId}/steps`)
  if (!res.ok) throw new Error('Failed to fetch steps')
  return res.json()
}

export default function WorkflowBoard({ projectId }: { projectId: string }) {
  const { data: steps, isLoading, error } = useQuery({
    queryKey: ['project-steps', projectId],
    queryFn: () => fetchSteps(projectId),
  })

  if (isLoading) return <p className="text-gray-500">Loading workflow…</p>
  if (error) return <p className="text-red-600">Failed to load workflow.</p>
  if (!steps?.length) return <p className="text-gray-500">No steps found.</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {steps.map(step => (
        <StepCard key={step.id} step={step} projectId={projectId} />
      ))}
    </div>
  )
}
