'use client'

import { useState } from 'react'
import TaskDetailModal from '@/components/task-detail-modal'

type TaskStatus = 'todo' | 'in_progress' | 'done'
type FilterTab = 'all' | TaskStatus

export interface TaskRow {
  id: string
  title: string
  status: TaskStatus
  due_date: string | null
  project_step_id: string
  project_id: string
  project_name: string
  step_title: string
}

const statusStyle: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

const statusLabel: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

export default function MyTaskList({
  tasks: initialTasks,
  currentUserId,
  isSA,
}: {
  tasks: TaskRow[]
  currentUserId: string
  isSA: boolean
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const filtered = activeFilter === 'all' ? tasks : tasks.filter(t => t.status === activeFilter)
  const openTask = tasks.find(t => t.id === openTaskId) ?? null

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const prev = tasks.find(t => t.id === taskId)?.status
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    setError(null)

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: prev! } : t))
      setError('Failed to update task status.')
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Tasks</h1>

      <div className="flex gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            data-testid={`filter-${f.key}`}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {filtered.length === 0 ? (
        <p className="text-gray-500">
          {activeFilter === 'all'
            ? 'No tasks assigned to you yet.'
            : `No ${statusLabel[activeFilter as TaskStatus]} tasks.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const isOverdue = t.due_date !== null && t.due_date < today && t.status !== 'done'
            return (
              <div key={t.id} className="p-4 border rounded-lg bg-white">
                <button
                  onClick={() => setOpenTaskId(t.id)}
                  className="text-sm font-medium hover:underline text-left w-full mb-2"
                >
                  {t.title}
                </button>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {t.project_name} › {t.step_title}
                    </span>
                    {t.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        Due {t.due_date}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(['todo', 'in_progress', 'done'] as TaskStatus[]).map(s => (
                      <button
                        key={s}
                        data-testid={`status-${t.id}-${s}`}
                        onClick={() => { if (t.status !== s) handleStatusChange(t.id, s) }}
                        className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                          t.status === s
                            ? statusStyle[s]
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {statusLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {openTask && (
        <TaskDetailModal
          taskId={openTask.id}
          taskTitle={openTask.title}
          currentUserId={currentUserId}
          isSA={isSA}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  )
}
