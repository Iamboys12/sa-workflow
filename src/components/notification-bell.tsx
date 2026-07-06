'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Notification } from '@/lib/types'

function formatMessage(n: Notification): string {
  const p = n.payload as Record<string, string>
  if (n.type === 'task_assigned') return `You were assigned to "${p.task_title}"`
  if (n.type === 'step_status_changed') return `Step "${p.step_title}" is now ${p.new_status}`
  return n.type
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (res.ok) setNotifications(await res.json())
  }, [])

  useEffect(() => {
    fetchAll()
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchAll])

  const unreadCount = notifications.filter(n => !n.read).length

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    const p = n.payload as Record<string, string>
    if (p.project_id) router.push(`/projects/${p.project_id}`)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative px-2">
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-medium text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">No notifications</div>
        ) : (
          notifications.map(n => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleClick(n)}
              className="flex items-start gap-2 px-3 py-2 cursor-pointer"
            >
              <div className="flex-shrink-0 mt-1.5">
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 block" />}
              </div>
              <div className={n.read ? 'pl-2' : ''}>
                <p className="text-sm leading-snug">{formatMessage(n)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{relativeTime(n.created_at)}</p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
