import { Fragment, useState } from 'react'
import { format, isWeekend, isToday } from 'date-fns'
import { Avatar } from '@/components/dp/Avatar'
import { ShiftCell } from '@/components/dp/ShiftCell'
import { buildGridData } from '../planGridUtils'
import { cn } from '@/lib/utils'
import type { ShiftWithDetails, Doctor, TarifWarning } from '@/lib/types'

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  shifts: ShiftWithDetails[]
  doctors: Doctor[]
  validFrom: string
  validTo: string
  onCellClick: (shiftId: number | null, doctorId: number, day: string) => void
  onConflictDotClick: (shift: ShiftWithDetails) => void
  onTarifDotClick?: (shift: ShiftWithDetails) => void
  tarifWarnings?: Record<number, TarifWarning[]>
}

export function PlanGrid({
  shifts, doctors, validFrom, validTo, onCellClick, onConflictDotClick, onTarifDotClick, tarifWarnings,
}: Props) {
  const { rows, days } = buildGridData(shifts, doctors, validFrom, validTo)
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)

  return (
    <div className="overflow-auto flex-1">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, 36px)` }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Header */}
        <div className="sticky left-0 bg-paper z-10 h-10 border-b border-line" />
        {days.map((day, colIdx) => {
          const isWe = isWeekend(day)
          const isTod = isToday(day)
          const abbr = WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]
          const isColHovered = hover?.col === colIdx
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={cn(
                'h-10 flex flex-col items-center justify-center border-b border-line transition-colors',
                isWe ? 'bg-weekend' : '',
                isTod ? 'bg-warn-bg text-warn-ink' : '',
                isColHovered && !isTod ? 'text-[#7A3414]' : '',
              )}
              style={isColHovered && !isTod ? { background: '#FBE5D6' } : undefined}
            >
              <span className="text-[10px] leading-none">{abbr}</span>
              <span className="text-[16px] font-serif leading-tight">
                {format(day, 'd')}
              </span>
            </div>
          )
        })}

        {/* Rows */}
        {rows.map(({ doctor, cells }, rowIdx) => {
          const isRowHovered = hover?.row === rowIdx
          return (
            <Fragment key={`row-${doctor.id}`}>
              {/* Doctor-Label */}
              <div
                key={`lbl-${doctor.id}`}
                className={cn(
                  'sticky left-0 bg-paper z-10 flex items-center gap-2 px-2 h-[42px] border-b border-line/50 transition-colors',
                  isRowHovered && 'bg-[#FAF0DC]',
                )}
              >
                <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={26} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">
                    {doctor.name}
                  </p>
                  <p className="text-[10px] text-ink-3 leading-none">
                    {doctor.is_facharzt
                      ? 'Facharzt'
                      : `WBJ ${doctor.weiterbildungsjahr ?? '–'}`}
                  </p>
                </div>
              </div>

              {/* Cells */}
              {days.map((day, colIdx) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const cell = cells[dayKey]
                const firstShift = cell?.shifts[0]
                const isTarget = isRowHovered && hover?.col === colIdx
                const isFilled = !!firstShift?.shift_type?.short_name
                return (
                  <div
                    key={`cell-${doctor.id}-${dayKey}`}
                    className={cn(
                      'h-[42px] flex items-center justify-center p-0.5 border-b border-line/30 transition-colors',
                      isWeekend(day) ? 'bg-weekend/40' : '',
                      isRowHovered && !isFilled ? 'bg-[#FAF0DC]' : '',
                    )}
                  >
                    <ShiftCell
                      code={firstShift?.shift_type?.short_name ?? undefined}
                      shiftTypeId={firstShift?.shift_type_id}
                      conflict={cell?.hasConflict}
                      tarifWarning={
                        firstShift != null &&
                        (tarifWarnings?.[firstShift.id]?.length ?? 0) > 0
                      }
                      weekend={isWeekend(day)}
                      today={isToday(day)}
                      onClick={() => onCellClick(firstShift?.id ?? null, doctor.id, dayKey)}
                      onConflictDotClick={
                        firstShift && cell?.hasConflict
                          ? () => onConflictDotClick(firstShift)
                          : undefined
                      }
                      onTarifDotClick={
                        firstShift && (tarifWarnings?.[firstShift.id]?.length ?? 0) > 0
                          ? () => onTarifDotClick?.(firstShift)
                          : undefined
                      }
                      showDot={!isFilled}
                      isHoverTarget={isTarget && !isFilled}
                      onMouseEnter={() => setHover({ row: rowIdx, col: colIdx })}
                      onFocus={() => setHover({ row: rowIdx, col: colIdx })}
                    />
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
