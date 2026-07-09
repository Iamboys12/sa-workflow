export interface OverdueTask {
  id: string
  title: string
  due_date: string
  assignee_name: string | null
  project_name: string
}

export default function OverdueAlert({ tasks }: { tasks: OverdueTask[] }) {
  if (tasks.length === 0) return null

  const visible = tasks.slice(0, 5)
  const remaining = tasks.slice(5)

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-sm font-semibold text-red-700 mb-2">
        ⚠ {tasks.length} overdue tasks
      </p>
      <ul className="space-y-1">
        {visible.map(t => (
          <li key={t.id} className="text-xs text-red-600">
            {t.title} — {t.project_name} — {t.assignee_name ?? 'Unassigned'} — Due {t.due_date}
          </li>
        ))}
      </ul>
      {remaining.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-red-500 cursor-pointer select-none list-none">
            {remaining.length} more
          </summary>
          <ul className="space-y-1 mt-1">
            {remaining.map(t => (
              <li key={t.id} className="text-xs text-red-600">
                {t.title} — {t.project_name} — {t.assignee_name ?? 'Unassigned'} — Due {t.due_date}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
