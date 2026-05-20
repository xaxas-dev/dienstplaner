import { Fragment } from 'react'
import { format, isWeekend, isToday } from 'date-fns'
import { useDroppable } from '@dnd-kit/core'
import { Avatar } from '@/components/dp/Avatar'
import { buildRotationGridData } from '../rotationGridUtils'
import type { RotationAssignmentWithDetails, Department } from '@/lib/types'

const ROTATION_DROP_ID_PREFIX = 'rotation-'

export function makeRotationDropId(departmentId: number, day: string): string {
  return `${ROTATION_DROP_ID_PREFIX}${departmentId}-${day}`
}

export function parseRotationDropId(id: string): { departmentId: number; day: string } | null {
  if (!id.startsWith(ROTATION_DROP_ID_PREFIX)) return null
  const rest = id.slice(ROTATION_DROP_ID_PREFIX.length)
  const dashIdx = rest.indexOf('-')
  if (dashIdx === -1) return null
  const departmentId = Number(rest.slice(0, dashIdx))
  const day = rest.slice(dashIdx + 1)
  return Number.isFinite(departmentId) ? { departmentId, day } : null
}

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface RotationDropCellProps {
  departmentId: number
  departmentName: string
  dayKey: string
  cell: {
    assignment: RotationAssignmentWithDetails
    isEinarbeitung: boolean
    overlap: boolean
  } | undefined
  isWe: boolean
  isTod: boolean
  onCellClick: (departmentId: number, day: string, assignmentId: number | null) => void
}

function RotationDropCell({ departmentId, departmentName, dayKey, cell, isWe, isTod, onCellClick }: RotationDropCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeRotationDropId(departmentId, dayKey),
    data: { departmentName, dayKey },
  })
  const doctor = cell?.assignment.doctor ?? null

  return (
    <div
      ref={setNodeRef}
      className={[
        'h-[42px] flex items-center justify-center p-0.5 border-b border-line/30',
        isWe ? 'bg-weekend/40' : '',
        isOver ? 'ring-2 ring-inset ring-accent' : '',
      ].join(' ')}
    >
      {cell && doctor ? (
        <button
          onClick={() => onCellClick(departmentId, dayKey, cell.assignment.id)}
          className={[
            'relative w-full h-full rounded-cell flex flex-col items-center justify-center px-0.5 transition',
            'hover:brightness-95',
            'bg-accent/10',
            isTod ? 'ring-2 ring-warn-line' : '',
            cell.overlap ? 'ring-[1.5px] ring-warn' : '',
          ].join(' ')}
        >
          <div className="flex items-center gap-1 w-full min-w-0 px-1">
            <Avatar name={doctor.name} id={cell.assignment.doctor_id} size={18} />
            <span className="text-[11px] font-medium leading-none truncate">
              {(doctor.short_name ?? doctor.name).slice(0, 8)}
            </span>
          </div>
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
          onClick={() => onCellClick(departmentId, dayKey, null)}
          aria-label={`${departmentName}, ${dayKey}, leer – Zuweisung hinzufügen`}
          className={[
            'aspect-square w-full rounded-cell border border-line transition',
            'hover:bg-card hover:border-line-2',
            isWe ? 'bg-weekend/40' : 'bg-paper/50',
            isTod ? 'ring-2 ring-warn-line' : '',
          ].join(' ')}
        />
      )}
    </div>
  )
}

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
              return (
                <RotationDropCell
                  key={`cell-${dept.id}-${dayKey}`}
                  departmentId={dept.id}
                  departmentName={dept.name}
                  dayKey={dayKey}
                  cell={cells[dayKey]}
                  isWe={isWeekend(day)}
                  isTod={isToday(day)}
                  onCellClick={onCellClick}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
