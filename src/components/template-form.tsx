'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CollaborationModel } from '@/lib/types'

type StepField = {
  key: string
  title: string
  collaboration_model: CollaborationModel
  deliverables: string[]
  newDeliverable: string
}

function blankStep(): StepField {
  return {
    key: String(Date.now()) + String(Math.random()),
    title: '',
    collaboration_model: 'human-led',
    deliverables: [],
    newDeliverable: '',
  }
}

export default function TemplateForm({
  templateId,
  initialName = '',
  initialSteps = [],
}: {
  templateId?: string
  initialName?: string
  initialSteps?: { title: string; collaboration_model: CollaborationModel; deliverables: string[] }[]
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [steps, setSteps] = useState<StepField[]>(
    initialSteps.length > 0
      ? initialSteps.map((s, i) => ({ ...s, key: String(i), newDeliverable: '' }))
      : [blankStep()]
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function updateStep(index: number, patch: Partial<StepField>) {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addDeliverable(index: number) {
    const step = steps[index]
    if (!step.newDeliverable.trim()) return
    updateStep(index, {
      deliverables: [...step.deliverables, step.newDeliverable.trim()],
      newDeliverable: '',
    })
  }

  function removeDeliverable(si: number, di: number) {
    setSteps(prev =>
      prev.map((s, i) =>
        i === si ? { ...s, deliverables: s.deliverables.filter((_, j) => j !== di) } : s
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const body = {
      name,
      steps: steps.map(({ title, collaboration_model, deliverables }) => ({
        title, collaboration_model, deliverables,
      })),
    }
    const url = templateId ? `/api/templates/${templateId}` : '/api/templates'
    const method = templateId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    router.push('/settings/templates')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="tmpl-name">Template Name *</Label>
        <Input id="tmpl-name" value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Steps</Label>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setSteps(prev => [...prev, blankStep()])}>
            + Add Step
          </Button>
        </div>
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={step.key} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Step {i + 1}</span>
                {steps.length > 1 && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setSteps(prev => prev.filter((_, si) => si !== i))}>
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <Label>Title *</Label>
                <Input
                  value={step.title}
                  onChange={e => updateStep(i, { title: e.target.value })}
                  placeholder="Step title"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Collaboration Model</Label>
                <Select
                  value={step.collaboration_model}
                  onValueChange={v => updateStep(i, { collaboration_model: v as CollaborationModel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="human-led">Human-led</SelectItem>
                    <SelectItem value="ai-assisted">AI-assisted</SelectItem>
                    <SelectItem value="paired">Paired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Deliverables</Label>
                {step.deliverables.map((d, di) => (
                  <div key={di} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 flex-1">• {d}</span>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => removeDeliverable(i, di)}>x</Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={step.newDeliverable}
                    onChange={e => updateStep(i, { newDeliverable: e.target.value })}
                    placeholder="Add deliverable..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDeliverable(i) } }}
                  />
                  <Button type="button" variant="outline" onClick={() => addDeliverable(i)}>Add</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : templateId ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </form>
  )
}
