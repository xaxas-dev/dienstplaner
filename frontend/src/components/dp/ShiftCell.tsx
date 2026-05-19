import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'

export function ShiftCell({
  code,
  shiftTypeId,
  conflict,
  weekend,
  today,
  onClick,
  onConflictDotClick,
}: {
  code?: string
  shiftTypeId?: number
  conflict?: boolean
  weekend?: boolean
  today?: boolean
  onClick?: () => void
  onConflictDotClick?: () => void
}) {
  if (!code) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'aspect-square w-full rounded-cell border border-line bg-paper/50 transition',
          'hover:bg-card hover:border-line-2',
          weekend && 'bg-weekend/40',
          today && 'ring-2 ring-warn-line',
        )}
      />
    )
  }
  const c = colorForShiftType({ id: shiftTypeId, code })
  return (
    <button
      onClick={onClick}
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
    </button>
  )
}
