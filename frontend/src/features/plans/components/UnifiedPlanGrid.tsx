import { useMemo, useState } from 'react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { eachDayOfInterval, format, isToday, isWeekend, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { getDepartmentColor } from '@/lib/bereichColors'
import { buildUnifiedRows, resolveCell } from '../unifiedGridUtils'
import type { RotationRow } from '../unifiedGridUtils'
import { BereichHeaderRow, makePlaceholderDropId, makeRotationMemberDropId } from './BereichHeaderRow'
import { UnifiedShiftCell } from './UnifiedShiftCell'
import type { Department, RotationAssignmentWithDetails, ShiftWithDetails, Absence, TarifWarning } from '@/lib/types'

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface UnifiedPlanGridProps {
  departments: Department[]
  rotations: RotationAssignmentWithDetails[]
  shifts: ShiftWithDetails[]
  absences: Absence[]
  validFrom: string
  validTo: string
  tarifWarningsByShift?: Record<number, TarifWarning[]>
  focusMode: 'alle' | 'vn'
  onCellClick?: (rotationId: number, doctorId: number, dayKey: string, shiftId: number | null) => void
  onConflictDotClick?: (shiftId: number) => void
  onTarifDotClick?: (shiftId: number) => void
}

function PlaceholderLabelCell({ department }: { department: Department }) {
  const color = getDepartmentColor(department)
  const { setNodeRef, isOver } = useDroppable({
    id: makePlaceholderDropId(department.id),
    data: { departmentId: department.id, departmentName: department.name },
  })
  return (
    <div
      ref={setNodeRef}
      className="sticky left-0 z-10 flex items-center pr-2 pl-4 py-1 bg-card border-b border-line text-[10px] transition-colors"
      style={{
        borderLeft: `4px solid ${color}30`,
        ...(isOver && { backgroundColor: `${color}20` }),
      }}
    >
      <span className={cn('italic', isOver ? 'text-ink' : 'text-muted-foreground')}>
        {isOver ? 'Arzt hier ablegen …' : 'Kein Arzt zugewiesen'}
      </span>
    </div>
  )
}

function RotationLabelCell({
  row,
  isHovered,
  onMouseEnter,
}: {
  row: RotationRow
  isHovered: boolean
  onMouseEnter: () => void
}) {
  const color = getDepartmentColor(row.department)
  const { setNodeRef, isOver } = useDroppable({
    id: makeRotationMemberDropId(row.rotation.id),
    data: { departmentId: row.department.id, departmentName: row.department.name },
  })
  return (
    <div
      ref={setNodeRef}
      onMouseEnter={onMouseEnter}
      className={cn(
        'sticky left-0 z-10 flex items-center gap-1.5 pr-2 pl-8 py-1 border-b border-line truncate transition-colors',
        !isOver && isHovered ? 'bg-paper' : 'bg-card',
      )}
      style={{
        borderLeft: `4px solid ${color}`,
        ...(isOver && { backgroundColor: `${color}20` }),
      }}
    >
      <span className="text-[11px] font-medium text-ink truncate">
        {row.doctor.name}
      </span>
    </div>
  )
}

export function UnifiedPlanGrid({
  departments,
  rotations,
  shifts,
  absences,
  validFrom,
  validTo,
  tarifWarningsByShift = {},
  focusMode,
  onCellClick,
  onConflictDotClick,
  onTarifDotClick,
}: UnifiedPlanGridProps) {
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const [hoverDay, setHoverDay] = useState<string | null>(null)

  const { active, over } = useDndContext()

  const days = useMemo(
    () => eachDayOfInterval({ start: parseISO(validFrom), end: parseISO(validTo) }),
    [validFrom, validTo],
  )

  const dayKeys = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days])

  const rows = useMemo(() => buildUnifiedRows(departments, rotations), [departments, rotations])

  const shiftIndex = useMemo(() => {
    const idx = new Map<string, ShiftWithDetails>()
    for (const s of shifts) {
      if (s.doctor_id != null) {
        idx.set(`${s.doctor_id}-${s.shift_date}`, s)
      }
    }
    return idx
  }, [shifts])

  const colCount = days.length

  // During drag, derive crosshair from dnd-kit over state (mouse events don't fire under overlay)
  let effectiveHoverRow = hoverRow
  let effectiveHoverDay = hoverDay

  if (active !== null && over) {
    const cellMatch = String(over.id).match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
    if (cellMatch) {
      const rotId = Number(cellMatch[1])
      const matchRow = rows.find((r) => r.kind === 'rotation' && r.rotation.id === rotId)
      effectiveHoverRow = matchRow?.rowKey ?? null
      effectiveHoverDay = cellMatch[2]
    } else {
      effectiveHoverRow = null
      effectiveHoverDay = null
    }
  }

  function clearHover() {
    setHoverRow(null)
    setHoverDay(null)
  }

  return (
    <div
      className="flex-1 min-w-0 min-h-0 overflow-auto rounded-2xl border border-line bg-card"
      onMouseLeave={clearHover}
    >
      <div
        className="grid text-xs"
        style={{
          gridTemplateColumns: `minmax(140px, 200px) repeat(${colCount}, minmax(36px, 1fr))`,
        }}
      >
        {/* Kopfzeile */}
        <div className="sticky top-0 left-0 z-20 bg-card border-b border-r border-line px-2 py-1 flex items-end">
          <span className="text-[10px] text-muted-foreground">Bereich / Arzt</span>
        </div>
        {days.map((day, i) => {
          const we = isWeekend(day)
          const tod = isToday(day)
          const dk = dayKeys[i]
          return (
            <div
              key={dk}
              onMouseEnter={() => { setHoverDay(dk); setHoverRow(null) }}
              className={cn(
                'sticky top-0 z-10 border-b border-r border-line text-center py-1 px-0.5 transition-colors',
                we ? 'text-muted-foreground' : 'text-ink',
                tod ? 'bg-accent/10 font-bold' : effectiveHoverDay === dk ? 'bg-paper/80' : 'bg-card',
              )}
            >
              <div className="text-[9px] leading-none">{WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
              <div className="text-[11px] leading-none mt-0.5">{day.getDate()}</div>
            </div>
          )
        })}

        {/* Daten-Zeilen */}
        {rows.map((row) => {
          if (row.kind === 'header') {
            return (
              <BereichHeaderRow
                key={row.rowKey}
                department={row.department}
                colCount={colCount}
              />
            )
          }

          if (row.kind === 'placeholder') {
            const color = getDepartmentColor(row.department)
            return (
              <div key={row.rowKey} className="contents">
                <PlaceholderLabelCell department={row.department} />
                {dayKeys.map((dk) => (
                  <div
                    key={dk}
                    className="border-b border-r border-line"
                    style={{ backgroundColor: `${color}10` }}
                  />
                ))}
              </div>
            )
          }

          // kind === 'rotation'
          const isRowHovered = effectiveHoverRow === row.rowKey

          return (
            <div key={row.rowKey} className="contents">
              <RotationLabelCell
                row={row}
                isHovered={isRowHovered}
                onMouseEnter={() => { setHoverRow(row.rowKey); setHoverDay(null) }}
              />

              {dayKeys.map((dk) => {
                const cell = resolveCell(row, dk, shifts, absences)
                const shift = shiftIndex.get(`${row.doctor.id}-${dk}`)
                const hasConflict = (shift?.conflicts.length ?? 0) > 0
                const hasTarifWarning = shift ? (tarifWarningsByShift[shift.id]?.length ?? 0) > 0 : false
                const day = days[dayKeys.indexOf(dk)]

                return (
                  <UnifiedShiftCell
                    key={dk}
                    rotationId={row.rotation.id}
                    dayKey={dk}
                    department={row.department}
                    inRotation={cell.inRotation}
                    text={cell.text}
                    isWeekend={isWeekend(day)}
                    isToday={isToday(day)}
                    hasConflict={hasConflict}
                    hasTarifWarning={hasTarifWarning}
                    focusMode={focusMode}
                    isHoveredRow={isRowHovered}
                    isHoveredCol={effectiveHoverDay === dk}
                    onMouseEnter={() => { setHoverRow(row.rowKey); setHoverDay(dk) }}
                    onClick={() => onCellClick?.(row.rotation.id, row.doctor.id, dk, shift?.id ?? null)}
                    onConflictDotClick={() => shift && onConflictDotClick?.(shift.id)}
                    onTarifDotClick={() => shift && onTarifDotClick?.(shift.id)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
