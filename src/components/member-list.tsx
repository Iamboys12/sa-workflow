'use client'

import { useState } from 'react'
import type { UserRole } from '@/lib/types'

type MemberEntry = {
  user_id: string
  role: UserRole
  profile: { id: string; full_name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  pm: 'PM',
  tech_lead: 'Tech Lead',
}

export default function MemberList({
  members: initial,
  projectId,
}: {
  members: MemberEntry[]
  projectId: string
}) {
  const [members, setMembers] = useState(initial)

  async function handleRoleChange(userId: string, role: UserRole) {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
    await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
    })
  }

  async function handleRemove(userId: string) {
    setMembers(prev => prev.filter(m => m.user_id !== userId))
    await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, user_id: userId }),
    })
  }

  return (
    <div data-testid="member-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Role</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.user_id} data-testid={`member-row-${m.user_id}`} className="border-b">
              <td className="py-3">{m.profile?.full_name ?? m.user_id}</td>
              <td className="py-3">
                <select
                  data-testid={`role-select-${m.user_id}`}
                  value={m.role}
                  onChange={e => handleRoleChange(m.user_id, e.target.value as UserRole)}
                  className="border rounded px-2 py-1 text-xs bg-white"
                >
                  {Object.keys(ROLE_LABELS).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <button
                  data-testid={`remove-btn-${m.user_id}`}
                  onClick={() => handleRemove(m.user_id)}
                  className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
