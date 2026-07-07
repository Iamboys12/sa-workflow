'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { StepStatus } from '@/lib/types'

const OPTIONS: { value: StepStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'text-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
  { value: 'blocked',     label: 'Blocked',     color: 'text-red-600' },
  { value: 'done',        label: 'Done',         color: 'text-green-600' },
]

export default function StepStatusSelect({
  projectId,
  stepId,
  status,
}: {
  projectId: string
  stepId: string
  status: StepStatus
}) {
  const { toast } = useToast()
  const [current, setCurrent] = useState<StepStatus>(status)
  const [loading, setLoading] = useState(false)

  async function handleChange(newStatus: StepStatus) {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLoading(false)
    if (res.ok) {
      setCurrent(newStatus)
      toast({ title: 'Step status updated' })
    } else {
      const data = await res.json()
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <Select value={current} onValueChange={v => handleChange(v as StepStatus)} disabled={loading}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className={opt.color}>{opt.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
