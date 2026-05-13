import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { ShiftType } from '@/lib/types'

interface ShiftHeatmap14Props {
  shifts: Array<{
    date: string
    shiftType?: ShiftType
  }>
  className?: string
}

export function ShiftHeatmap14({ shifts, className }: ShiftHeatmap14Props) {
  const boxes = Array.from({ length: 14 }, (_, i) => shifts[i] ?? null)

  return (
    <div className={cn('flex gap-0.5', className)}>
      {boxes.map((entry, i) => {
        if (entry?.shiftType) {
          const c = colorForShiftType({ id: entry.shiftType.id, code: entry.shiftType.short_name })
          return (
            <span
              key={i}
              className="rounded-sm flex-1 h-4"
              style={{ backgroundColor: c.bg }}
              title={entry.shiftType.short_name}
            />
          )
        }
        return (
          <span
            key={i}
            className="rounded-sm flex-1 h-4 border border-dashed border-line/40 bg-line/20"
          />
        )
      })}
    </div>
  )
}
