'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { TaskEvent } from '@/lib/types'

function formatActivity(event: TaskEvent): string {
  if (event.type === 'status_change') {
    const m = event.meta as { from: string; to: string }
    return `Status changed: ${m.from} → ${m.to}`
  }
  if (event.type === 'assigned') {
    const m = event.meta as { to_user_name: string | null }
    return m.to_user_name ? `Assigned to ${m.to_user_name}` : 'Unassigned'
  }
  if (event.type === 'due_date_set') {
    const m = event.meta as { to: string | null }
    return m.to ? `Due date set to ${m.to}` : 'Due date removed'
  }
  return ''
}

export default function TaskDetailModal({
  taskId,
  taskTitle,
  currentUserId,
  isSA,
  onClose,
}: {
  taskId: string
  taskTitle: string
  currentUserId: string
  isSA: boolean
  onClose: () => void
}) {
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/events`)
      .then(r => r.json())
      .then((data: TaskEvent[]) => setEvents(data))
      .catch(() => {})
  }, [taskId])

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`task_events:${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_events', filter: `task_id=eq.${taskId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            fetch(`/api/tasks/${taskId}/events`)
              .then(r => r.json())
              .then((data: TaskEvent[]) => setEvents(data))
              .catch(() => {})
          }
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setEvents(prev => prev.filter(e => e.id !== old.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    await fetch(`/api/tasks/${taskId}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: newComment.trim() }),
    }).catch(() => {})
    setNewComment('')
    setSubmitting(false)
  }

  async function handleDelete(eventId: string) {
    await fetch(`/api/tasks/${taskId}/events/${eventId}`, { method: 'DELETE' }).catch(() => {})
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900 truncate">{taskTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {events.length === 0 && (
            <p className="text-sm text-gray-400 text-center">No activity yet.</p>
          )}
          {events.map(event => (
            <div key={event.id} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs">
                {event.type === 'comment' ? '💬' : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">{event.user_name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                  {event.type === 'comment' && (isSA || event.user_id === currentUserId) && (
                    <button
                      data-testid={`delete-${event.id}`}
                      onClick={() => handleDelete(event.id)}
                      className="text-xs text-red-400 hover:text-red-600 ml-auto"
                    >
                      ลบ
                    </button>
                  )}
                </div>
                {event.type === 'comment' ? (
                  <p className="text-sm text-gray-700 mt-0.5">{event.body}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5 italic">{formatActivity(event)}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 px-5 py-4 border-t">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="พิมพ์ comment..."
            className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
            ส่ง
          </Button>
        </form>
      </div>
    </div>
  )
}
