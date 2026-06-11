import { Link } from 'react-router-dom'
import type { CoverageBar as CoverageBarData } from '@/lib/types'

export function CoverageBar({ bar, href }: { bar: CoverageBarData; href?: string }) {
  const isEmpty = bar.filled === 0 && bar.total > 0
  const isFull = bar.total > 0 && bar.filled >= bar.total
  const pct = bar.total > 0 ? Math.min(100, Math.round((bar.filled / bar.total) * 100)) : 0

  const barColor = isFull ? 'bg-emerald-600' : isEmpty ? 'bg-red-500' : 'bg-amber-400'
  const labelColor = isFull ? 'text-emerald-700' : isEmpty ? 'text-red-600' : 'text-amber-700'

  const content = (
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

  if (href) {
    return (
      <Link to={href} className="block rounded hover:bg-paper/60 transition-colors -mx-1 px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent">
        {content}
      </Link>
    )
  }

  return content
}
