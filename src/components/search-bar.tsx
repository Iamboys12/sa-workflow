'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'

interface ProjectResult {
  id: string
  name: string
  status: string
}

interface TaskResult {
  id: string
  title: string
  status: string
  assigned_to: string | null
  project_name: string
  project_id: string
}

interface SearchResults {
  projects: ProjectResult[]
  tasks: TaskResult[]
}

interface Profile {
  id: string
  full_name: string
}

type TaskStatus = 'todo' | 'in_progress' | 'done'

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

export default function SearchBar({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => {
      if (data) setProfiles(data as Profile[])
    })
  }, [currentUserId])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const search = useCallback(async (q: string, status: string, assignee: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ q })
    if (status) params.set('status', status)
    if (assignee) params.set('assignee', assignee)
    const res = await fetch(`/api/search?${params}`)
    if (res.ok) {
      const data = await res.json() as SearchResults
      setResults(data)
      setOpen(true)
    } else {
      setResults({ projects: [], tasks: [] })
      setOpen(true)
    }
    setLoading(false)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      search(q, statusFilter, assigneeFilter)
    }, 300)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setResults(null)
    }
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as TaskStatus | ''
    setStatusFilter(status)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    search(query, status, assigneeFilter)
  }

  function handleAssigneeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const assignee = e.target.value
    setAssigneeFilter(assignee)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    search(query, statusFilter, assignee)
  }

  function handleProjectClick(id: string) {
    router.push(`/projects/${id}`)
    setOpen(false)
  }

  function handleTaskClick(projectId: string) {
    router.push(`/projects/${projectId}`)
    setOpen(false)
  }

  const showDropdown = open && query.trim().length >= 2
  const isEmpty = results !== null && results.projects.length === 0 && results.tasks.length === 0

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Search projects & tasks..."
        className="w-56 px-3 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
        data-testid="search-input"
      />
      {showDropdown && (
        <div
          className="absolute top-full right-0 mt-1 w-96 bg-white border rounded-lg shadow-lg z-50"
          data-testid="search-dropdown"
        >
          <div className="flex gap-2 p-2 border-b">
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              className="text-xs border rounded px-2 py-1 bg-white"
              data-testid="status-filter"
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={handleAssigneeChange}
              className="text-xs border rounded px-2 py-1 bg-white"
              data-testid="assignee-filter"
            >
              <option value="">All assignees</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="px-3 py-4 text-sm text-gray-500">Searching...</div>
          ) : isEmpty ? (
            <div className="px-3 py-4 text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {results!.projects.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Projects
                  </div>
                  {results!.projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleProjectClick(p.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      data-testid={`project-result-${p.id}`}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400">{p.status}</span>
                    </button>
                  ))}
                </div>
              )}
              {results!.tasks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t">
                    Tasks
                  </div>
                  {results!.tasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTaskClick(t.project_id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      data-testid={`task-result-${t.id}`}
                    >
                      <span>{t.title}</span>
                      <span className="text-xs text-gray-400">{t.status} — {t.project_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
