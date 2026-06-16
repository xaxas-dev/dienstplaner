import { useRef } from 'react'
import { useAppSettings } from '@/stores/useAppSettings'
import { useDroppable } from '@dnd-kit/core'
import { Lock, Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getDepartmentColor } from '@/lib/bereichColors'
import { shiftTypeColorMuted } from '@/lib/shiftTypeColors'
import type { AbsenceType, Department } from '@/lib/types'

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
  activeFilterGroups: Set<string>
  shiftFilterGroup?: string | null
  isHoveredRow?: boolean
  isHoveredCol?: boolean
  shiftId?: number
  isConflictTarget?: boolean
  isPinned?: boolean
  shiftAssigned?: boolean
  shiftTypeColor?: string
  isLocked?: boolean
  isSelected?: boolean
  isHighlightedRow?: boolean
  isDragDimmed?: boolean
  isDragHighlighted?: boolean
  isDragAbsenceBlocked?: boolean
  absenceId?: number
  absenceType?: AbsenceType | null
  absenceColors?: Record<AbsenceType, string>
  onDoubleClickRemoveAbsence?: (absenceId: number) => void
  onMouseEnter?: () => void
  onMouseDown?: () => void
  onClick?: (shiftKey: boolean, clickPos: { x: number; y: number }) => void
  onDoubleClickRemove?: () => void
  onConflictDotClick?: () => void
  onTarifDotClick?: () => void
  wishHint?: 'avoid' | 'require' | null
  wishBadge?: string | null
  doctorId?: number
  onWishCreate?: (doctorId: number, date: string) => void
  springerDeptShortName?: string
  springerAssignmentId?: number
  onDoubleClickRemoveSpringer?: (assignmentId: number) => void
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
  activeFilterGroups,
  shiftFilterGroup,
  isHoveredRow,
  isHoveredCol,
  shiftId,
  isConflictTarget,
  isLocked,
  isPinned,
  shiftAssigned,
  shiftTypeColor,
  isSelected,
  isHighlightedRow,
  isDragDimmed,
  isDragHighlighted,
  isDragAbsenceBlocked,
  absenceId,
  absenceType,
  absenceColors,
  onDoubleClickRemoveAbsence,
  onMouseEnter,
  onMouseDown,
  onClick,
  onDoubleClickRemove,
  onConflictDotClick,
  onTarifDotClick,
  wishHint,
  wishBadge,
  doctorId,
  onWishCreate,
  springerDeptShortName,
  springerAssignmentId,
  onDoubleClickRemoveSpringer,
}: UnifiedShiftCellProps) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { springerColor } = useAppSettings()

  const { setNodeRef, isOver } = useDroppable({
    id: makeCellDropId(rotationId, dayKey),
    data: { rotationId, dayKey },
  })

  function handleClick(e: React.MouseEvent) {
    if (isLocked) return
    const { shiftKey } = e
    const clickPos = { x: e.clientX, y: e.clientY }
    const needsDoubleClickDelay =
      (onDoubleClickRemove && shiftAssigned) ||
      (onDoubleClickRemoveAbsence && absenceId !== undefined) ||
      (onDoubleClickRemoveSpringer !== undefined && springerAssignmentId !== undefined)

    if (needsDoubleClickDelay) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
      clickTimerRef.current = setTimeout(() => { onClick?.(shiftKey, clickPos) }, 300)
    } else {
      onClick?.(shiftKey, clickPos)
    }
  }

  function handleDoubleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    // Absence-Delete hat Vorrang
    if (absenceId !== undefined) {
      onDoubleClickRemoveAbsence?.(absenceId)
      return
    }
    // Shift-Delete hat Vorrang (Zusatzdienst zuerst bei geteilter Zelle)
    if (shiftAssigned) {
      if (isPinned) {
        toast.info('Gepinnte Schicht — erst entpinnen')
        return
      }
      onDoubleClickRemove?.()
      return
    }
    // Springer-Delete (nur wenn kein regulärer Shift)
    if (springerAssignmentId !== undefined) {
      onDoubleClickRemoveSpringer?.(springerAssignmentId)
      return
    }
  }

  const bereichColor = getDepartmentColor(department)
  const dimmed =
    activeFilterGroups.size > 0 &&
    shiftFilterGroup != null &&
    !activeFilterGroups.has(shiftFilterGroup)
  const showCrosshair = (isHoveredRow || isHoveredCol) && !dimmed

  // Absence cells use configured absence type color. Assigned shifts use shift type color.
  // Empty rotation slots use neutral gray. Out-of-rotation stays faint dept color.
  const bg = (() => {
    // Split-Mode: beide Hälften übernehmen ihr eigenes Bg
    if (springerDeptShortName && text) return 'transparent'
    // Nur Springer (kein regulärer Shift)
    if (springerDeptShortName && !text) return springerColor
    if (absenceId !== undefined) {
      const absColor = absenceType && absenceColors?.[absenceType]
      if (absColor) return inRotation ? absColor + '80' : absColor + '40'
      return inRotation ? '#E5E7EB' : '#E5E7EB40'
    }
    if (shiftAssigned) return shiftTypeColorMuted(shiftTypeColor)
    if (inRotation) return '#f4f4f5'
    return `${bereichColor}28`
  })()

  return (
    <div
      ref={setNodeRef}
      data-grid-cell=""
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      {...(shiftId !== undefined ? { 'data-shift-id': String(shiftId) } : {})}
      className={cn(
        'relative h-full min-h-[28px] flex items-center justify-center',
        'border-b border-r border-line cursor-pointer select-none',
        'text-[11px] font-medium leading-none group',
        isToday && 'ring-1 ring-inset ring-accent',
        isOver && 'ring-2 ring-inset ring-blue-400',
        isConflictTarget && 'bg-red-50/70 ring-1 ring-inset ring-red-400/50',
        isSelected && 'ring-2 ring-inset ring-accent',
        dimmed && 'opacity-30 grayscale',
        isDragDimmed && !text && 'opacity-30 grayscale',
        isDragAbsenceBlocked && 'opacity-40 grayscale',
        isDragHighlighted && 'ring-1 ring-inset ring-emerald-400/60',
      )}
      style={{ backgroundColor: isConflictTarget || isSelected ? undefined : bg }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Lock-Indikator */}
      {isLocked && (
        <Lock
          data-testid="lock-icon"
          className="absolute top-0.5 left-0.5 size-2.5 text-zinc-400/70 z-[2]"
        />
      )}

      {/* Crosshair-Highlight */}
      {showCrosshair && !isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(198,106,61,0.09)' }}
        />
      )}

      {/* Weekend-Overlay — dezente Einfärbung Sa/So (nur leere Zellen) */}
      {isWeekend && !isConflictTarget && !isSelected && !shiftAssigned && absenceId === undefined && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(243, 236, 216, 0.45)' }}
        />
      )}

      {/* Highlighted-Row-Tint */}
      {isHighlightedRow && !isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(198,106,61,0.12)' }}
        />
      )}

      {/* Selected-Overlay */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(198,106,61,0.15)' }}
        />
      )}

      {/* Drag-Highlight-Tint: Spalten ohne diesen Dienst */}
      {isDragHighlighted && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(52, 211, 153, 0.07)' }}
        />
      )}

      {/* Split-Cell: Springer oben, Shift unten */}
      {springerDeptShortName && text ? (
        <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
          <div
            className="flex-1 flex items-center justify-center text-[10px] font-normal leading-none text-ink"
            style={{ backgroundColor: springerColor }}
          >
            {springerDeptShortName}
          </div>
          <div
            className="flex-1 flex items-center justify-center text-[11px] font-medium leading-none"
            style={{ background: shiftTypeColorMuted(shiftTypeColor) }}
          >
            {text}
          </div>
        </div>
      ) : springerDeptShortName ? (
        <span className="text-[11px] font-normal leading-none pointer-events-none select-none text-ink">
          {springerDeptShortName}
        </span>
      ) : (
        text && (
          <span
            className={cn(
              'relative z-[1]',
              isWeekend ? 'text-gray-600' : 'text-gray-800',
              !inRotation && 'opacity-50',
            )}
          >
            {text}
          </span>
        )
      )}

      {/* Tarif-Dot (Sand, oben links) */}
      {hasTarifWarning && !isLocked && (
        <button
          className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-sand border border-warn-line text-[7px] flex items-center justify-center z-[2]"
          onClick={(e) => { e.stopPropagation(); onTarifDotClick?.() }}
          aria-label="Tarif-Warnung"
        >
          §
        </button>
      )}

      {/* Konflikt-Dot (Warn, oben rechts) */}
      {hasConflict && !isLocked && (
        <button
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warn text-[7px] flex items-center justify-center text-white z-[2]"
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          aria-label="Konflikt"
        >
          !
        </button>
      )}

      {/* Wish-Hint */}
      {wishHint && !isLocked && (
        <span
          className={cn(
            'absolute inset-0 pointer-events-none',
            text
              ? cn('ring-2 ring-inset', wishHint === 'avoid' ? 'ring-amber-400' : 'ring-green-500')
              : (wishHint === 'avoid' ? 'bg-amber-50/60' : 'bg-green-50/60'),
          )}
        />
      )}

      {/* Wish-Typ-Badge (links unten, zeigt konkreten Wunschtyp) */}
      {wishHint && !isLocked && wishBadge && (
        <span
          className={cn(
            'absolute bottom-0.5 left-0.5 text-[7px] font-semibold leading-none px-0.5 rounded-sm pointer-events-none z-[1]',
            wishHint === 'avoid'
              ? 'text-amber-800 bg-amber-100/90'
              : 'text-green-800 bg-green-100/90',
          )}
        >
          {wishBadge}
        </span>
      )}

      {/* Wish Schnellerfassung */}
      {onWishCreate && doctorId !== undefined && !isLocked && (
        <button
          className="absolute bottom-0.5 right-0.5 w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 z-[3]"
          onClick={(e) => { e.stopPropagation(); onWishCreate(doctorId, dayKey) }}
          aria-label="Wunsch erfassen"
          tabIndex={-1}
        >
          <Star className="w-2.5 h-2.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
