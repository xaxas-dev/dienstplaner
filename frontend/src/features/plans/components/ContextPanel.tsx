import { X } from 'lucide-react'
import { ConflictCard } from './ConflictCard'
import type { components } from '@/lib/api-types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

interface Props {
  shift: ShiftWithDetails
  onClose: () => void
}

export function ContextPanel({ shift, onClose }: Props) {
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
      </div>
    </div>
  )
}
