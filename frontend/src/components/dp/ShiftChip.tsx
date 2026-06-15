import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'

export function ShiftChip({
  code,
  shiftTypeId,
  color,
  size = 'md',
  className,
}: {
  code: string
  shiftTypeId?: number
  color?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  const c = colorForShiftType({ id: shiftTypeId, code, color })
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full font-semibold leading-none', sizeCls, className)}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {code}
    </span>
  )
}
