import { createServerSupabase } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import TemplateForm from '@/components/template-form'
import type { WorkflowTemplateStep } from '@/lib/types'

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'sa') redirect('/dashboard')

  const { data: template } = await supabase
    .from('workflow_templates')
    .select('*, steps:workflow_template_steps(*)')
    .eq('id', params.id)
    .single()

  if (!template) notFound()
  if (template.is_default) redirect('/settings/templates')

  const steps = ((template.steps ?? []) as WorkflowTemplateStep[])
    .sort((a, b) => a.order - b.order)
    .map(({ title, collaboration_model, deliverables }) => ({ title, collaboration_model, deliverables }))

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit Template</h1>
      <Card>
        <CardContent className="pt-6">
          <TemplateForm
            templateId={params.id}
            initialName={template.name}
            initialSteps={steps}
          />
        </CardContent>
      </Card>
    </div>
  )
}
