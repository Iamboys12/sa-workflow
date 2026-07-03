'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TaskItem from './task-item'
import type { Task } from '@/lib/types'

async function fetchTasks(stepId: string): Promise<Task[]> {
  const res = await fetch(`/api/tasks?step_id=${stepId}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export default function TaskList({
  stepId,
  isSA,
}: {
  stepId: string
  isSA: boolean
}) {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', stepId],
    queryFn: () => fetchTasks(stepId),
  })

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_step_id: stepId, title }),
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', stepId] }) },
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createMutation.mutateAsync(newTitle.trim())
    setNewTitle('')
  }

  if (isLoading) return <p className="text-gray-500 text-sm">Loading tasks…</p>

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          isSA={isSA}
          onUpdate={(id, updates) => updateMutation.mutateAsync({ id, updates })}
          onDelete={(id) => deleteMutation.mutateAsync(id)}
        />
      ))}

      {isSA && (
        <form onSubmit={handleCreate} className="flex gap-2 mt-3">
          <Input
            placeholder="Add a task…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
