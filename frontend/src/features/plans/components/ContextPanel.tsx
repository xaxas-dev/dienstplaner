import { X } from 'lucide-react'
import { ConflictCard } from './ConflictCard'
import type { components } from '@/lib/api-types'
import type { TarifWarning } from '@/lib/types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info',
  warning: 'Warnung',
  critical: 'Kritisch',
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-sand text-ink',
  warning: 'bg-warn-bg text-warn-ink',
  critical: 'bg-warn text-paper',
}

interface Props {
  shift: ShiftWithDetails
  onClose: () => void
  tarifWarnings?: TarifWarning[]
}

export function ContextPanel({ shift, onClose, tarifWarnings }: Props) {
  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-card border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="text-sm font-medium">
          {shift.shift_type?.short_name} · {shift.shift_date}
        </p>
        <button
          aria-label="Schließen"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {shift.conflicts.map((conflict, i) => (
          <ConflictCard key={i} conflict={conflict} />
        ))}
        {tarifWarnings && tarifWarnings.length > 0 && (
          <div className="space-y-2">
            {shift.conflicts.length > 0 && (
              <div className="border-t border-line pt-2" />
            )}
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              Tarif-Warnungen
            </p>
            {tarifWarnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-line bg-paper p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink',
                    ].join(' ')}
                  >
                    {SEVERITY_LABEL[w.severity] ?? w.severity}
                  </span>
                  <span className="text-[11px] text-ink-3">{w.rule_id}</span>
                </div>
                <p className="text-[12px] text-ink leading-snug">{w.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
