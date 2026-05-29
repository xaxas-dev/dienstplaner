import type { CoverageBar as CoverageBarData } from '@/lib/types'

export function CoverageBar({ bar }: { bar: CoverageBarData }) {
  const isEmpty = bar.filled === 0 && bar.total > 0
  const isFull = bar.total > 0 && bar.filled >= bar.total
  const pct = bar.total > 0 ? Math.min(100, Math.round((bar.filled / bar.total) * 100)) : 0

  const barColor = isFull ? 'bg-emerald-600' : isEmpty ? 'bg-red-500' : 'bg-amber-400'
  const labelColor = isFull ? 'text-emerald-700' : isEmpty ? 'text-red-600' : 'text-amber-700'

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 text-xs text-ink-2 truncate">{bar.department_name}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-8 text-right text-xs tabular-nums font-semibold shrink-0 ${labelColor}`}>
        {bar.filled}/{bar.total}
      </span>
    </div>
  )
}
