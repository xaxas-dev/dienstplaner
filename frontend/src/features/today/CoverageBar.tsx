import type { CoverageBar as CoverageBarData } from '@/lib/types'

export function CoverageBar({ bar }: { bar: CoverageBarData }) {
  const pct = Math.round(bar.pct * 100)
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0 text-xs text-ink-2 truncate">{bar.department_name}</span>
      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs text-ink-3 tabular-nums">{pct}%</span>
    </div>
  )
}
