// frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { AbsenceType } from '@/lib/types'

export const ABSENCE_DRAG_ID_PREFIX = 'absence-'

export function makeAbsenceDragId(type: AbsenceType): string {
  return `${ABSENCE_DRAG_ID_PREFIX}${type}`
}

const VALID_ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
]

export function parseAbsenceDragId(id: string): AbsenceType | null {
  if (!id.startsWith(ABSENCE_DRAG_ID_PREFIX)) return null
  const type = id.slice(ABSENCE_DRAG_ID_PREFIX.length) as AbsenceType
  return VALID_ABSENCE_TYPES.includes(type) ? type : null
}

const ABSENCE_CHIP_META: Record<AbsenceType, { short: string; full: string }> = {
  URLAUB:       { short: 'U',      full: 'Urlaub' },
  KRANKHEIT:    { short: 'K',      full: 'Krankheit' },
  FORTBILDUNG:  { short: 'FB',     full: 'Fortbildung' },
  ELTERNZEIT:   { short: 'EZ',     full: 'Elternzeit' },
  MUTTERSCHUTZ: { short: 'MuSchu', full: 'Mutterschutz' },
  SONSTIGES:    { short: 'EA',     full: 'Sonstiges' },
}

export function AbsenceTypeDragBar() {
  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card"
      aria-label="Abwesenheits-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
        Abwesenheiten
      </span>
      {VALID_ABSENCE_TYPES.map((type) => (
        <AbsenceTypeChip key={type} absenceType={type} />
      ))}
    </div>
  )
}

function AbsenceTypeChip({ absenceType }: { absenceType: AbsenceType }) {
  const { short, full } = ABSENCE_CHIP_META[absenceType]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeAbsenceDragId(absenceType),
    data: { absenceType },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'px-2.5 py-1 rounded-md border border-[#d4c8b4] text-[11px] font-semibold cursor-grab select-none',
        'bg-[#FFF8F0] text-[#7a5c3a] hover:bg-[#FFF0E0] active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
      )}
      title={full}
    >
      {short}
    </div>
  )
}
