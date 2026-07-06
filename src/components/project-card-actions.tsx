'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Project, ProjectStatus } from '@/lib/types'

const TRANSITIONS: Record<ProjectStatus, { status: ProjectStatus; label: string }[]> = {
  active:    [{ status: 'completed', label: 'Mark as Completed' }, { status: 'archived', label: 'Archive' }],
  completed: [{ status: 'active',    label: 'Restore to Active' }, { status: 'archived', label: 'Archive' }],
  archived:  [{ status: 'active',    label: 'Restore to Active' }],
}

export default function ProjectCardActions({ project }: { project: Project }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const transitions = TRANSITIONS[project.status] ?? []

  async function handleTransition(e: React.MouseEvent, status: ProjectStatus) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-6 w-6 p-0"
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
        >
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {transitions.map(t => (
          <DropdownMenuItem key={t.status} onClick={e => handleTransition(e, t.status)}>
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
