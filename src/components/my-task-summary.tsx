import Link from 'next/link'

export default function MyTaskSummary({
  todo,
  inProgress,
  done,
}: {
  todo: number
  inProgress: number
  done: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">My Tasks</h2>
        <Link href="/my-tasks" className="text-xs text-blue-500 hover:underline">View all →</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-gray-800">{todo}</div>
          <div className="text-xs text-gray-500 mt-0.5">To Do</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-700">{inProgress}</div>
          <div className="text-xs text-blue-500 mt-0.5">In Progress</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700">{done}</div>
          <div className="text-xs text-green-500 mt-0.5">Done</div>
        </div>
      </div>
    </div>
  )
}
