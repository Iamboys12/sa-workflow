export interface WorkloadEntry {
  user_id: string | null
  name: string
  todo: number
  in_progress: number
  total: number
}

export default function WorkloadList({ entries }: { entries: WorkloadEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">No tasks assigned yet.</p>
  }

  const maxTotal = Math.max(...entries.map(e => e.total), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left py-2 pr-4 font-medium">Name</th>
            <th className="text-right py-2 px-2 font-medium">Todo</th>
            <th className="text-right py-2 px-2 font-medium">In Progress</th>
            <th className="text-right py-2 px-2 font-medium">Total</th>
            <th className="py-2 pl-4 w-32" />
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const key = e.user_id ?? 'unassigned'
            const barPct = Math.round((e.total / maxTotal) * 100)
            return (
              <tr key={key} className="border-b last:border-0">
                <td className="py-2 pr-4 text-gray-700">{e.name}</td>
                <td data-testid={`todo-${key}`} className="text-right py-2 px-2 text-gray-600">{e.todo}</td>
                <td data-testid={`inprogress-${key}`} className="text-right py-2 px-2 text-gray-600">{e.in_progress}</td>
                <td data-testid={`total-${key}`} className="text-right py-2 px-2 font-medium text-gray-800">{e.total}</td>
                <td className="py-2 pl-4">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${barPct}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
