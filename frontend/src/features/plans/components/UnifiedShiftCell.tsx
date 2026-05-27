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
  isHoveredRow?: boolean
  isHoveredCol?: boolean
  onMouseEnter?: () => void
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
  isHoveredRow,
  isHoveredCol,
  onMouseEnter,
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
  const showCrosshair = (isHoveredRow || isHoveredCol) && !dimmed

  // Background: full color in rotation, faint tint outside
  const bg = inRotation ? bereichColor : `${bereichColor}28`

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={onMouseEnter}
      className={cn(
        'relative h-full min-h-[28px] flex items-center justify-center',
        'border-b border-r border-line cursor-pointer select-none',
        'text-[11px] font-medium leading-none',
        isToday && 'ring-1 ring-inset ring-accent',
        isOver && 'ring-2 ring-inset ring-blue-400',
        dimmed && 'opacity-30 grayscale',
      )}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      {/* Crosshair-Highlight */}
      {showCrosshair && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(198,106,61,0.09)' }}
        />
      )}

      {text && (
        <span
          className={cn(
            'relative z-[1]',
            isWeekend ? 'text-gray-600' : 'text-gray-800',
            !inRotation && 'opacity-50',
          )}
        >
          {text}
        </span>
      )}

      {/* Tarif-Dot (Sand, oben links) */}
      {hasTarifWarning && (
        <button
          className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-sand border border-warn-line text-[7px] flex items-center justify-center z-[2]"
          onClick={(e) => { e.stopPropagation(); onTarifDotClick?.() }}
          aria-label="Tarif-Warnung"
        >
          §
        </button>
      )}

      {/* Konflikt-Dot (Warn, oben rechts) */}
      {hasConflict && (
        <button
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warn text-[7px] flex items-center justify-center text-white z-[2]"
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          aria-label="Konflikt"
        >
          !
        </button>
      )}
    </div>
  )
}
