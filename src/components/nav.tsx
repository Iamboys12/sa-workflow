'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import NotificationBell from '@/components/notification-bell'
import type { Profile } from '@/lib/types'

export default function Nav({ profile }: { profile: Profile | null }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b bg-white px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold text-gray-900">SA Workflow</Link>
        {profile?.role === 'sa' && (
          <Link href="/settings/templates" className="text-sm text-gray-600 hover:text-gray-900">
            Templates
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {profile && <NotificationBell userId={profile.id} />}
        <span className="text-sm text-gray-600">{profile?.full_name}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
      </div>
    </nav>
  )
}
