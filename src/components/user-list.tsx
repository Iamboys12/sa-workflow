'use client'

import { useState } from 'react'
import type { Profile, UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  sa: 'SA',
  pm: 'PM',
  tech_lead: 'Tech Lead',
}

export default function UserList({
  users: initial,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initial)

  async function handleRoleChange(userId: string, role: UserRole) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u))
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_active: isActive }),
    })
  }

  return (
    <div data-testid="user-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Full Name</th>
            <th className="pb-2 font-medium">Global Role</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr
              key={u.id}
              data-testid={`user-row-${u.id}`}
              className={`border-b ${!u.is_active ? 'opacity-50' : ''}`}
            >
              <td className="py-3">{u.full_name}</td>
              <td className="py-3">
                <select
                  data-testid={`role-select-${u.id}`}
                  value={u.role}
                  disabled={u.id === currentUserId}
                  onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                  className="border rounded px-2 py-1 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {u.is_active ? 'Active' : 'Deactivated'}
                </span>
              </td>
              <td className="py-3">
                <button
                  data-testid={`deactivate-btn-${u.id}`}
                  disabled={u.id === currentUserId}
                  onClick={() => handleToggleActive(u.id, !u.is_active)}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
