export default function StatCard({
  label,
  value,
  color = 'neutral',
}: {
  label: string
  value: number | string
  color?: 'neutral' | 'red' | 'green'
}) {
  const valueClass =
    color === 'red' ? 'text-red-600' :
    color === 'green' ? 'text-green-600' :
    'text-gray-900'

  return (
    <div className="bg-white rounded-lg border p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span data-testid="stat-value" className={`text-2xl font-bold ${valueClass}`}>{value}</span>
    </div>
  )
}
