import { Fragment } from 'react'
import { format, isWeekend, isToday } from 'date-fns'
import { useDroppable } from '@dnd-kit/core'
import { Avatar } from '@/components/dp/Avatar'
import { buildRotationGridData } from '../rotationGridUtils'
import type { RotationAssignmentWithDetails, Department, INAAvailability } from '@/lib/types'

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

interface DeptPreview {
  doctorId: number
  doctorName: string
  dateFrom: string
  dateTo: string
}

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
  deptPreview?: DeptPreview | null
  unavailableHint?: boolean
  unavailableReasons?: string[]
}

function RotationDropCell({ departmentId, departmentName, dayKey, cell, isWe, isTod, onCellClick, deptPreview, unavailableHint, unavailableReasons }: RotationDropCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeRotationDropId(departmentId, dayKey),
    data: { departmentName, dayKey },
  })
  const doctor = cell?.assignment.doctor ?? null
  const isPreview = !cell && deptPreview != null && dayKey >= deptPreview.dateFrom && dayKey <= deptPreview.dateTo

  const tooltipTitle = unavailableHint && unavailableReasons && unavailableReasons.length > 0
    ? unavailableReasons.join(', ')
    : undefined

  return (
    <div
      ref={setNodeRef}
      title={tooltipTitle}
      className={[
        'h-[42px] flex items-center justify-center p-0.5 border-b border-line/50',
        isWe ? 'bg-weekend' : '',
        isOver ? 'bg-accent/25 ring-[3px] ring-inset ring-accent' : '',
        unavailableHint ? 'ring-1 ring-amber-400/60' : '',
      ].join(' ')}
    >
      {cell && doctor ? (
        <button
          onClick={() => onCellClick(departmentId, dayKey, cell.assignment.id)}
          className={[
            'relative w-full h-full rounded-cell flex flex-col items-center justify-center px-0.5 transition',
            'hover:brightness-95 border border-line/20',
            'bg-accent/15',
            isTod ? 'ring-2 ring-warn-line' : '',
            cell.overlap ? 'ring-[1.5px] ring-warn' : '',
          ].join(' ')}
        >
          <Avatar name={doctor.name} id={cell.assignment.doctor_id} size={22} />
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
      ) : isPreview ? (
        <div
          className={[
            'w-full h-full rounded-cell flex items-center justify-center',
            'border border-dashed border-accent/70 bg-accent/10 opacity-60',
            isTod ? 'ring-2 ring-warn-line' : '',
          ].join(' ')}
        >
          <Avatar name={deptPreview!.doctorName} id={deptPreview!.doctorId} size={22} />
        </div>
      ) : (
        <button
          onClick={() => onCellClick(departmentId, dayKey, null)}
          aria-label={`${departmentName}, ${dayKey}, leer – Zuweisung hinzufügen`}
          className={[
            'w-full h-full rounded-cell border border-line/70 bg-card transition',
            isTod ? 'ring-2 ring-warn-line' : '',
          ].join(' ')}
        />
      )}
    </div>
  )
}

interface RotationGridPreview {
  departmentId: number
  doctorId: number
  doctorName: string
  dateFrom: string
  dateTo: string
}

interface Props {
  rotations: RotationAssignmentWithDetails[]
  departments: Department[]
  validFrom: string
  validTo: string
  onCellClick: (departmentId: number, day: string, assignmentId: number | null) => void
  preview?: RotationGridPreview | null
  availability?: Record<string, INAAvailability>
}

export function RotationGrid({
  rotations,
  departments,
  validFrom,
  validTo,
  onCellClick,
  preview,
  availability,
}: Props) {
  const { rows, days } = buildRotationGridData(rotations, departments, validFrom, validTo)

  return (
    <div className="overflow-auto flex-1">
      <div
        className="grid"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, minmax(36px, 1fr))` }}
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
        {rows.map(({ department: dept, cells }) => {
          const deptPreview = preview?.departmentId === dept.id
            ? { doctorId: preview.doctorId, doctorName: preview.doctorName, dateFrom: preview.dateFrom, dateTo: preview.dateTo }
            : null
          return (
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
              const availEntry = availability?.[dayKey]
              const unavailableHint = availEntry !== undefined && !availEntry.available
              const unavailableReasons = unavailableHint ? availEntry.reasons : undefined
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
                  deptPreview={deptPreview}
                  unavailableHint={unavailableHint}
                  unavailableReasons={unavailableReasons}
                />
              )
            })}
          </Fragment>
          )
        })}
      </div>
    </div>
  )
}
