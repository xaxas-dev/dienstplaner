import { useMemo, useState } from 'react'
import { eachDayOfInterval, format, isToday, isWeekend, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { getDepartmentColor } from '@/lib/bereichColors'
import { buildUnifiedRows, resolveCell } from '../unifiedGridUtils'
import { BereichHeaderRow } from './BereichHeaderRow'
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

  const days = useMemo(
    () => eachDayOfInterval({ start: parseISO(validFrom), end: parseISO(validTo) }),
    [validFrom, validTo],
  )

  const dayKeys = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days])

  const rows = useMemo(() => buildUnifiedRows(departments, rotations), [departments, rotations])

  // Shifts indexed by doctor_id + date for fast lookup
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

  return (
    <div
      className="overflow-auto rounded-2xl border border-line bg-card"
      onMouseLeave={() => setHoverRow(null)}
    >
      <div
        className="grid text-xs"
        style={{
          gridTemplateColumns: `minmax(120px, 180px) repeat(${colCount}, minmax(36px, 1fr))`,
        }}
      >
        {/* Kopfzeile: Tag-Nummern + Wochentag-Kürzel */}
        <div className="sticky top-0 left-0 z-20 bg-card border-b border-r border-line px-2 py-1 flex items-end">
          <span className="text-[10px] text-muted-foreground">Arzt / Bereich</span>
        </div>
        {days.map((day, i) => {
          const we = isWeekend(day)
          const tod = isToday(day)
          return (
            <div
              key={dayKeys[i]}
              className={cn(
                'sticky top-0 z-10 bg-card border-b border-r border-line text-center py-1 px-0.5',
                we ? 'text-muted-foreground' : 'text-ink',
                tod && 'bg-accent/10 font-bold',
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
                <div
                  className="sticky left-0 z-10 flex items-center px-3 py-1 bg-card border-b border-line text-[10px] text-muted-foreground italic"
                  style={{ borderLeft: `4px solid ${color}20` }}
                >
                  Kein Arzt zugewiesen
                </div>
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
          const isHovered = hoverRow === row.rowKey
          const color = getDepartmentColor(row.department)

          return (
            <div
              key={row.rowKey}
              className="contents"
              onMouseEnter={() => setHoverRow(row.rowKey)}
            >
              {/* Arzt-Spalte */}
              <div
                className={cn(
                  'sticky left-0 z-10 flex items-center gap-1.5 px-2 py-1 bg-card border-b border-line truncate',
                  isHovered && 'bg-paper',
                )}
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <span className="text-[11px] font-medium text-ink truncate">
                  {row.doctor.short_name ?? row.doctor.name}
                </span>
              </div>

              {/* Tag-Zellen */}
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
