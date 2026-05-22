import { Fragment, useState } from 'react'
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
  doctorShortName?: string | null
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
  isHoverTarget?: boolean
  isRowHovered?: boolean
  onMouseEnter?: () => void
}

function RotationDropCell({ departmentId, departmentName, dayKey, cell, isWe, isTod, onCellClick, deptPreview, unavailableHint, unavailableReasons, isHoverTarget, isRowHovered, onMouseEnter }: RotationDropCellProps) {
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
      onMouseEnter={onMouseEnter}
      className={[
        'h-[42px] flex items-center justify-center p-0.5 border-b border-line/50',
        isWe ? 'bg-weekend' : '',
        isRowHovered && !isOver ? 'bg-[#FAF0DC]' : '',
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
          <Avatar
            name={doctor.name}
            shortName={doctor.short_name}
            id={cell.assignment.doctor_id}
            size={22}
          />
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
          <Avatar
            name={deptPreview!.doctorName}
            shortName={deptPreview!.doctorShortName}
            id={deptPreview!.doctorId}
            size={22}
          />
        </div>
      ) : (
        <button
          onClick={() => onCellClick(departmentId, dayKey, null)}
          aria-label={`${departmentName}, ${dayKey}, leer – Zuweisung hinzufügen`}
          className={[
            'w-full h-full rounded-cell border transition flex items-center justify-center',
            isHoverTarget ? 'border-dashed' : 'border-line/70 bg-card',
            isTod ? 'ring-2 ring-warn-line' : '',
          ].join(' ')}
          style={isHoverTarget ? {
            borderColor: '#C66A3D',
            borderWidth: '1.5px',
            background: 'rgba(198, 106, 61, 0.08)',
            borderRadius: '7px',
            transition: 'background 80ms ease-out, border-color 80ms ease-out',
          } : undefined}
        >
          {isHoverTarget ? (
            <span
              className="text-[14px] font-medium pointer-events-none select-none"
              style={{ color: '#C66A3D' }}
              aria-hidden
            >
              +
            </span>
          ) : (
            <span
              className="pointer-events-none"
              style={{
                display: 'block',
                width: 5,
                height: 5,
                borderRadius: 999,
                background: isWe ? '#CBC2AC' : '#D6CCB6',
              }}
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  )
}

interface RotationGridPreview {
  departmentId: number
  doctorId: number
  doctorName: string
  doctorShortName?: string | null
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
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)

  return (
    <div className="overflow-auto flex-1">
      <div
        className="grid"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, minmax(36px, 1fr))` }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Header */}
        <div className="sticky left-0 bg-card z-10 h-10 border-b border-line flex items-center px-3">
          <span className="text-[11px] font-medium text-ink-3 uppercase tracking-wide">Bereich</span>
        </div>
        {days.map((day, colIdx) => {
          const isWe = isWeekend(day)
          const isTod = isToday(day)
          const abbr = WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]
          const isColHovered = hover?.col === colIdx
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={[
                'h-10 flex flex-col items-center justify-center border-b border-line transition-colors',
                isWe ? 'bg-weekend' : '',
                isTod ? 'bg-warn-bg text-warn-ink' : '',
                isColHovered && !isTod ? 'text-[#7A3414]' : '',
              ].join(' ')}
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
        {rows.map(({ department: dept, cells }, rowIdx) => {
          const isRowHovered = hover?.row === rowIdx
          const deptPreview = preview?.departmentId === dept.id
            ? {
                doctorId: preview.doctorId,
                doctorName: preview.doctorName,
                doctorShortName: preview.doctorShortName,
                dateFrom: preview.dateFrom,
                dateTo: preview.dateTo,
              }
            : null
          return (
          <Fragment key={`row-${dept.id}`}>
            {/* Left label column */}
            <div
              className={[
                'sticky left-0 bg-paper z-10 flex flex-col justify-center px-3 h-[42px] border-b border-line/50 min-w-0 transition-colors',
                isRowHovered ? 'bg-[#FAF0DC]' : '',
              ].join(' ')}
              onMouseEnter={() => setHover({ row: rowIdx, col: -1 })}
            >
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
            {days.map((day, colIdx) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const availEntry = availability?.[dayKey]
              const unavailableHint = availEntry !== undefined && !availEntry.available
              const unavailableReasons = unavailableHint ? availEntry.reasons : undefined
              const isTarget = isRowHovered && hover?.col === colIdx
              const isFilled = !!cells[dayKey]
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
                  isHoverTarget={isTarget && !isFilled}
                  isRowHovered={isRowHovered}
                  onMouseEnter={() => setHover({ row: rowIdx, col: colIdx })}
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
