import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import { Avatar } from '@/components/dp/Avatar'

export type DragState = 'valid' | 'invalid' | 'hover-target' | null

export function ShiftCell({
  code,
  shiftTypeId,
  conflict,
  tarifWarning,
  weekend,
  today,
  onClick,
  onConflictDotClick,
  onTarifDotClick,
  // Affordance-Props:
  showDot = false,
  isHoverTarget = false,
  dragState = null,
  dragPreviewDoctor = null,
  onMouseEnter,
  onFocus,
}: {
  code?: string
  shiftTypeId?: number
  conflict?: boolean
  tarifWarning?: boolean
  weekend?: boolean
  today?: boolean
  onClick?: () => void
  onConflictDotClick?: () => void
  onTarifDotClick?: () => void
  showDot?: boolean
  isHoverTarget?: boolean
  dragState?: DragState
  dragPreviewDoctor?: { name: string; short_name?: string | null; id: number } | null
  onMouseEnter?: () => void
  onFocus?: () => void
}) {
  if (!code) {
    // Layer priority: drag > hover-target > idle-dot
    let cellContent: React.ReactNode = null
    let extraClasses = ''
    let extraStyle: React.CSSProperties = {}

    if (dragState === 'valid') {
      extraClasses = 'border border-dashed'
      extraStyle = {
        background: 'rgba(122, 158, 85, 0.12)',
        borderColor: 'rgba(122, 158, 85, 0.55)',
      }
    } else if (dragState === 'invalid') {
      extraClasses = 'border-0'
      extraStyle = {
        background: 'rgba(0, 0, 0, 0.04)',
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 5px)',
      }
    } else if (dragState === 'hover-target') {
      extraClasses = 'border border-solid'
      extraStyle = {
        background: 'rgba(198, 106, 61, 0.16)',
        borderColor: '#C66A3D',
        borderWidth: '1.5px',
      }
      if (dragPreviewDoctor) {
        cellContent = (
          <span className="opacity-95 pointer-events-none">
            <Avatar
              name={dragPreviewDoctor.name}
              shortName={dragPreviewDoctor.short_name}
              id={dragPreviewDoctor.id}
              size={18}
            />
          </span>
        )
      }
    } else if (isHoverTarget) {
      extraClasses = 'border border-dashed'
      extraStyle = {
        background: 'rgba(198, 106, 61, 0.08)',
        borderColor: '#C66A3D',
        borderWidth: '1.5px',
        borderRadius: '7px',
        transition: 'background 80ms ease-out, border-color 80ms ease-out',
      }
      cellContent = (
        <span
          className="text-[14px] font-medium pointer-events-none select-none"
          style={{ color: '#C66A3D' }}
          aria-hidden
        >
          +
        </span>
      )
    } else if (showDot) {
      cellContent = (
        <span
          className="pointer-events-none"
          style={{
            display: 'block',
            width: 5,
            height: 5,
            borderRadius: 999,
            background: weekend ? '#CBC2AC' : '#D6CCB6',
          }}
          aria-hidden
        />
      )
    }

    return (
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        className={cn(
          'aspect-square w-full rounded-cell border border-line bg-paper/50 transition',
          'flex items-center justify-center',
          'hover:bg-card hover:border-line-2',
          weekend && 'bg-weekend/40',
          today && 'ring-2 ring-warn-line',
          (isHoverTarget || dragState) && 'border-transparent hover:bg-transparent',
          extraClasses,
        )}
        style={extraStyle}
      >
        {cellContent}
      </button>
    )
  }
  const c = colorForShiftType({ id: shiftTypeId, code })
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={cn(
        'relative aspect-square w-full rounded-cell text-[11px] font-bold leading-none transition',
        'hover:brightness-95',
        conflict && 'ring-[1.5px] ring-warn',
        today && 'ring-2 ring-warn-line',
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {code}
      {conflict && (
        <span
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-warn text-[8px] font-bold text-paper"
        >
          !
        </span>
      )}
      {tarifWarning && (
        <span
          onClick={(e) => { e.stopPropagation(); onTarifDotClick?.() }}
          className="absolute -left-1 -top-1 grid size-3 place-items-center rounded-full bg-sand border border-warn-line text-[8px] font-bold text-ink"
        >
          §
        </span>
      )}
    </button>
  )
}
