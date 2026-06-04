import { X } from 'lucide-react'
import type { FairnessStat } from '../fairnessUtils'

interface FairnessSidebarProps {
  stats: FairnessStat[]
  groups: string[]
  onClose: () => void
}

export function FairnessSidebar({ stats, groups, onClose }: FairnessSidebarProps) {
  const colTemplate = `1fr ${groups.map(() => '2.25rem').join(' ')} 2.25rem`

  return (
    <div className="w-60 shrink-0 flex flex-col border border-line rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="text-xs font-semibold text-ink">Fairness</span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition"
          aria-label="Schließen"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Spalten-Header */}
      <div
        className="grid border-b border-line text-[10px] text-ink-3 font-medium bg-paper/40"
        style={{ gridTemplateColumns: colTemplate }}
      >
        <div className="px-2 py-1.5">Arzt</div>
        {groups.map((g) => (
          <div key={g} className="px-1 py-1.5 text-center truncate" title={g}>
            {g}
          </div>
        ))}
        <div className="px-1 py-1.5 text-center">∑</div>
      </div>

      {/* Arzt-Zeilen */}
      <div className="flex-1 overflow-y-auto">
        {stats.length === 0 ? (
          <div className="px-3 py-4 text-xs text-ink-3 text-center">Keine Ärzte im Plan</div>
        ) : (
          stats.map((stat) => (
            <div
              key={stat.doctorId}
              className="grid border-b border-line last:border-0 text-xs hover:bg-paper/60 transition-colors"
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div className="px-2 py-1.5 truncate text-ink" title={stat.doctorName}>
                {stat.shortName ?? stat.doctorName}
              </div>
              {groups.map((g) => (
                <div
                  key={g}
                  className={`px-1 py-1.5 text-center tabular-nums ${
                    (stat.byGroup[g] ?? 0) > 0 ? 'text-ink' : 'text-ink-3'
                  }`}
                >
                  {stat.byGroup[g] ?? 0}
                </div>
              ))}
              <div
                className={`px-1 py-1.5 text-center font-medium tabular-nums ${
                  stat.total > 0 ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {stat.total}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
