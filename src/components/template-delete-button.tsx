'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function TemplateDeleteButton({ templateId }: { templateId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setLoading(true)
    await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
    setLoading(false)
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
