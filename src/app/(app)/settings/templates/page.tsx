import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import type { WorkflowTemplate, WorkflowTemplateStep } from '@/lib/types'

type TemplateWithSteps = WorkflowTemplate & { steps: WorkflowTemplateStep[] }

export default async function TemplatesPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'sa') redirect('/dashboard')

  const { data: templates } = await supabase
    .from('workflow_templates')
    .select('*, steps:workflow_template_steps(id, order, title, collaboration_model, deliverables, template_id)')
    .order('is_default', { ascending: false })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Workflow Templates</h1>
      <div className="space-y-4">
        {(templates as TemplateWithSteps[] ?? []).map(t => (
          <div key={t.id} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold">{t.name}</h2>
              {t.is_default && <Badge className="bg-blue-100 text-blue-700">default</Badge>}
              <span className="text-sm text-gray-400 ml-auto">
                {t.steps?.length ?? 0} steps
              </span>
            </div>
            <div className="space-y-1">
              {(t.steps ?? [])
                .sort((a, b) => a.order - b.order)
                .map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 w-5">{s.order}.</span>
                    <span>{s.title}</span>
                    <span className="text-xs text-gray-400">({s.collaboration_model})</span>
                  </div>
                ))
              }
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-6">
        Custom templates can be created via API or extended in Phase 2.
      </p>
    </div>
  )
}
