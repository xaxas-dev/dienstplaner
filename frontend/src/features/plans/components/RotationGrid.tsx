import { Fragment } from 'react'
import { format, isWeekend, isToday } from 'date-fns'
import { Avatar } from '@/components/dp/Avatar'
import { buildRotationGridData } from '../rotationGridUtils'
import type { RotationAssignmentWithDetails, Department } from '@/lib/types'

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  rotations: RotationAssignmentWithDetails[]
  departments: Department[]
  validFrom: string
  validTo: string
  onCellClick: (departmentId: number, day: string, assignmentId: number | null) => void
}

export function RotationGrid({
  rotations,
  departments,
  validFrom,
  validTo,
  onCellClick,
}: Props) {
  const { rows, days } = buildRotationGridData(rotations, departments, validFrom, validTo)

  return (
    <div className="overflow-auto flex-1">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, 36px)` }}
      >
        {/* Header */}
        <div className="sticky left-0 bg-card z-10 h-10 border-b border-line flex items-center px-3">
          <span className="text-[11px] font-medium text-ink-3 uppercase tracking-wide">Bereich</span>
        </div>
        {days.map((day) => {
          const isWe = isWeekend(day)
          const isTod = isToday(day)
          const abbr = WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={[
                'h-10 flex flex-col items-center justify-center border-b border-line',
                isWe ? 'bg-weekend' : '',
                isTod ? 'bg-warn-bg text-warn-ink' : '',
              ].join(' ')}
            >
              <span className="text-[10px] text-ink-3 leading-none">{abbr}</span>
              <span className="text-[16px] font-serif leading-tight">
                {format(day, 'd')}
              </span>
            </div>
          )
        })}

        {/* Rows */}
        {rows.map(({ department: dept, cells }) => (
          <Fragment key={`row-${dept.id}`}>
            {/* Left label column */}
            <div className="sticky left-0 bg-card z-10 flex flex-col justify-center px-3 h-[42px] border-b border-line/50 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[13px] font-medium leading-tight truncate">
                  {dept.name}
                </p>
                {(dept.blocks_ina_weekdays || dept.blocks_ina_weekends) && (
                  <span className="shrink-0 text-[9px] text-warn-ink bg-warn-bg px-1 rounded leading-tight">
                    INA-Sperre
                  </span>
                )}
              </div>
              {dept.short_name && (
                <p className="text-[10px] text-ink-3 leading-none truncate">
                  {dept.short_name}
                </p>
              )}
            </div>

            {/* Day cells */}
            {days.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const cell = cells[dayKey]
              const isWe = isWeekend(day)
              const isTod = isToday(day)
              const doctor = cell?.assignment.doctor ?? null

              return (
                <div
                  key={`cell-${dept.id}-${dayKey}`}
                  className={[
                    'h-[42px] flex items-center justify-center p-0.5 border-b border-line/30',
                    isWe ? 'bg-weekend/40' : '',
                  ].join(' ')}
                >
                  {cell && doctor ? (
                    <button
                      onClick={() => onCellClick(dept.id, dayKey, cell.assignment.id)}
                      className={[
                        'relative w-full h-full rounded-cell flex flex-col items-center justify-center px-0.5 transition',
                        'hover:brightness-95',
                        'bg-accent/10',
                        isTod ? 'ring-2 ring-warn-line' : '',
                        cell.overlap ? 'ring-[1.5px] ring-warn' : '',
                      ].join(' ')}
                    >
                      {/* Doctor avatar + name */}
                      <div className="flex items-center gap-1 w-full min-w-0 px-1">
                        <Avatar name={doctor.name} id={cell.assignment.doctor_id} size={18} />
                        <span className="text-[11px] font-medium leading-none truncate">
                          {(doctor.short_name ?? doctor.name).slice(0, 8)}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {cell.isEinarbeitung && (
                          <span className="text-[8px] font-bold bg-accent text-paper px-0.5 rounded leading-tight">
                            E
                          </span>
                        )}
                        {cell.overlap && (
                          <span className="text-[8px] font-bold text-warn-ink leading-tight">
                            !
                          </span>
                        )}
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => onCellClick(dept.id, dayKey, null)}
                      className={[
                        'aspect-square w-full rounded-cell border border-line bg-paper/50 transition',
                        'hover:bg-card hover:border-line-2',
                        isWe ? 'bg-weekend/40' : '',
                        isTod ? 'ring-2 ring-warn-line' : '',
                      ].join(' ')}
                    />
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
