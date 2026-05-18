import type { components } from '@/lib/api-types'

type ShiftConflict = components['schemas']['ShiftConflict']

const CONFLICT_LABELS: Record<string, string> = {
  not_available: 'NOT_AVAILABLE',
  double_booked: 'DOUBLE_BOOKED',
}

export function ConflictCard({ conflict }: { conflict: ShiftConflict }) {
  return (
    <div className="rounded-xl border border-warn-line bg-warn-bg p-3 space-y-1.5">
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-warn text-paper">
        {CONFLICT_LABELS[conflict.conflict_type] ?? conflict.conflict_type}
      </span>
      <p className="text-xs text-warn-ink leading-snug">{conflict.message}</p>
      <p className="text-[10px] text-ink-3">
        {conflict.doctor_name} · {conflict.shift_date} · {conflict.shift_type_short_name}
      </p>
    </div>
  )
}
