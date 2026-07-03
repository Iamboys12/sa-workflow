'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/lib/types'

const nextStatus: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

const statusStyle: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

export default function TaskItem({
  task,
  isSA,
  onUpdate,
  onDelete,
}: {
  task: Task
  isSA: boolean
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  async function toggleStatus() {
    setLoading(true)
    await onUpdate(task.id, { status: nextStatus[task.status] })
    setLoading(false)
  }

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      task.status === 'done' && 'opacity-60'
    )}>
      {isSA && (
        <button
          onClick={toggleStatus}
          disabled={loading}
          className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-400 flex items-center justify-center hover:border-blue-500"
        >
          {task.status === 'done' && <span className="text-xs text-green-600">✓</span>}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', task.status === 'done' && 'line-through text-gray-400')}>
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-gray-400">Due {task.due_date}</p>
        )}
      </div>
      <Badge className={statusStyle[task.status]}>{task.status}</Badge>
      {isSA && (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 h-7"
          onClick={() => onDelete(task.id)}
        >
          ×
        </Button>
      )}
    </div>
  )
}
