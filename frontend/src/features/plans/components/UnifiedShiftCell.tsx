import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { getDepartmentColor } from '@/lib/bereichColors'
import type { Department } from '@/lib/types'

export function makeCellDropId(rotationId: number, dayKey: string): string {
  return `cell-${rotationId}-${dayKey}`
}

interface UnifiedShiftCellProps {
  rotationId: number
  dayKey: string
  department: Department
  inRotation: boolean
  text: string
  isWeekend: boolean
  isToday: boolean
  hasConflict?: boolean
  hasTarifWarning?: boolean
  focusMode: 'alle' | 'vn'
  onClick?: () => void
  onConflictDotClick?: () => void
  onTarifDotClick?: () => void
}

export function UnifiedShiftCell({
  rotationId,
  dayKey,
  department,
  inRotation,
  text,
  isWeekend,
  isToday,
  hasConflict,
  hasTarifWarning,
  focusMode,
  onClick,
  onConflictDotClick,
  onTarifDotClick,
}: UnifiedShiftCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeCellDropId(rotationId, dayKey),
    data: { rotationId, dayKey },
  })

  const bereichColor = getDepartmentColor(department)
  const isVN = text === 'V' || text === 'N'
  const isAbsenceCode = ['U', 'K', 'Fo', 'EZ', 'MuSchu', 'EA'].includes(text)
  const dimmed = focusMode === 'vn' && text !== '' && !isVN && !isAbsenceCode

  const bg = inRotation ? bereichColor : undefined
  const opacity = inRotation ? 1 : 0.3

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative h-full min-h-[28px] flex items-center justify-center',
        'border-b border-r border-line cursor-pointer select-none',
        'text-[11px] font-medium leading-none',
        isToday && 'ring-1 ring-inset ring-accent',
        isOver && 'ring-2 ring-inset ring-blue-400',
        dimmed && 'opacity-30 grayscale',
      )}
      style={{ backgroundColor: bg, opacity }}
      onClick={onClick}
    >
      {text && (
        <span className={cn(isWeekend ? 'text-gray-600' : 'text-gray-800')}>{text}</span>
      )}

      {/* Tarif-Dot (Sand, oben links) */}
      {hasTarifWarning && (
        <button
          className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-sand border border-warn-line text-[7px] flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onTarifDotClick?.() }}
          aria-label="Tarif-Warnung"
        >
          §
        </button>
      )}

      {/* Konflikt-Dot (Warn, oben rechts) */}
      {hasConflict && (
        <button
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warn text-[7px] flex items-center justify-center text-white"
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          aria-label="Konflikt"
        >
          !
        </button>
      )}
    </div>
  )
}
