'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function InviteMemberForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'pm' | 'tech_lead'>('pm')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, email, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess(true)
    setEmail('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="pm@company.com"
          required
        />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as 'pm' | 'tech_lead')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pm">Project Manager</SelectItem>
            <SelectItem value="tech_lead">Tech Lead</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Member invited successfully.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Inviting…' : 'Invite'}
      </Button>
    </form>
  )
}
