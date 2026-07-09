import { Badge } from '@/components/ui/badge'

export interface DueTask {
  id: string
  title: string
  status: string
  due_date: string
  project_name: string
  is_overdue: boolean
}

const statusStyle: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

export default function UpcomingDueList({ tasks }: { tasks: DueTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400">No upcoming deadlines 🎉</p>
  }

  return (
    <div className="space-y-2">
      {tasks.map(t => (
        <div
          key={t.id}
          data-testid={`due-task-${t.id}`}
          className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
            t.is_overdue
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-white text-gray-700'
          }`}
        >
          <span className={`text-xs font-medium w-24 flex-shrink-0 ${t.is_overdue ? 'text-red-600' : 'text-gray-400'}`}>
            Due {t.due_date}
          </span>
          <span className="flex-1 truncate">{t.title}</span>
          <Badge className={statusStyle[t.status] ?? 'bg-gray-100 text-gray-700'}>{t.status}</Badge>
          <span className="text-xs text-gray-400 flex-shrink-0">{t.project_name}</span>
        </div>
      ))}
    </div>
  )
}
