import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import TemplateForm from '@/components/template-form'

export default async function NewTemplatePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'sa') redirect('/dashboard')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">New Template</h1>
      <Card>
        <CardContent className="pt-6">
          <TemplateForm />
        </CardContent>
      </Card>
    </div>
  )
}
