import { Avatar } from '@/components/dp/Avatar'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { DutyShift } from '@/lib/types'

export function DutyShiftRow({ shift }: { shift: DutyShift }) {
  const color = colorForShiftType({ code: shift.shift_type_short_name })
  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color.dot }}
      />
      <span className="flex-1 text-sm font-medium text-ink">{shift.shift_type_name}</span>
      {shift.time_label && (
        <span className="text-xs font-mono text-ink-3">{shift.time_label}</span>
      )}
      <div className="flex items-center gap-1">
        {shift.doctors.length === 0 ? (
          <span className="text-xs text-ink-3 italic">unbesetzt</span>
        ) : (
          shift.doctors.map(doc => (
            <Avatar key={doc.id} id={doc.id} name={doc.name} size={24} />
          ))
        )}
      </div>
    </div>
  )
}
