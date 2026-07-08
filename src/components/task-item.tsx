'use client'

import { useState, useEffect } from 'react'
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

interface Member {
  user_id: string
  profile: { id: string; full_name: string }
}

export default function TaskItem({
  task,
  isSA,
  canAssign,
  projectId,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  task: Task
  isSA: boolean
  canAssign: boolean
  projectId: string
  currentUserId: string
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!canAssign) return
    const controller = new AbortController()
    fetch(`/api/members?project_id=${projectId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMembers(data) })
      .catch(() => {})
    return () => controller.abort()
  }, [canAssign, projectId])

  const isAssignee = task.assigned_to === currentUserId
  const canToggleStatus = isSA || isAssignee

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
      {canToggleStatus && (
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
        {task.assignee && !canAssign && (
          <p className="text-xs text-gray-400">Assigned to {task.assignee.full_name}</p>
        )}
      </div>
      {canAssign && (
        <select
          value={task.assigned_to ?? ''}
          onChange={e => onUpdate(task.id, { assigned_to: e.target.value || null })}
          className="text-xs border rounded px-1 py-0.5 text-gray-600 max-w-[130px]"
        >
          <option value="">Unassigned</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>
          ))}
        </select>
      )}
      {canAssign && (
        <input
          type="date"
          value={task.due_date ?? ''}
          onChange={e => onUpdate(task.id, { due_date: e.target.value || null })}
          className="text-xs border rounded px-1 py-0.5 text-gray-600"
        />
      )}
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
