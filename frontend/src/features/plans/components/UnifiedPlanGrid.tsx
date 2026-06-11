import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { eachDayOfInterval, format, isToday, isWeekend, parseISO } from 'date-fns'
import { ExternalLink, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDepartmentColor } from '@/lib/bereichColors'
import { getCurrentEmploymentPeriod } from '@/features/doctors/doctorHelpers'
import { buildUnifiedRows, resolveCell } from '../unifiedGridUtils'
import type { RotationRow } from '../unifiedGridUtils'
import { getWishHint, getWishBadge } from '../wishGridUtils'
import { BereichHeaderRow, makePlaceholderDropId, makeRotationMemberDropId } from './BereichHeaderRow'
import { UnifiedShiftCell } from './UnifiedShiftCell'
import type { Department, Doctor, RotationAssignmentWithDetails, ShiftWithDetails, Absence, TarifWarning, Wish, ShiftType } from '@/lib/types'

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface UnifiedPlanGridProps {
  departments: Department[]
  doctors?: Doctor[]
  rotations: RotationAssignmentWithDetails[]
  shifts: ShiftWithDetails[]
  absences: Absence[]
  validFrom: string
  validTo: string
  tarifWarningsByShift?: Record<number, TarifWarning[]>
  holidayDates?: Set<string>
  activeFilterGroups: Set<string>
  dragConflictMap?: Map<number, Set<string>> | null
  dragDimDays?: Set<string>
  selectedCellKeys?: Set<string>
  highlightedDoctorId?: number | null
  onCellClick?: (rotationId: number, doctorId: number, dayKey: string, shiftId: number | null, shiftKey: boolean, clickPos: { x: number; y: number }) => void
  onDoubleClickRemove?: (shiftId: number) => void
  onDoubleClickRemoveAbsence?: (absenceId: number) => void
  onDeleteRotation?: (rotationId: number) => void
  onEditRotation?: (rotation: RotationAssignmentWithDetails) => void
  onRangeSelected?: (rotationId: number, doctorId: number, dayKeys: string[]) => void
  onConflictDotClick?: (shiftId: number) => void
  onTarifDotClick?: (shiftId: number) => void
  onAddRotation?: (departmentId: number) => void
  onDepartmentClick?: (departmentId: number) => void
  wishes?: Wish[]
  showWishes?: boolean
  shiftTypes?: ShiftType[]
  onWishCreate?: (doctorId: number, date: string) => void
  onDoctorClick?: (doctorId: number) => void
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
  isHighlighted,
  employmentPct,
  onMouseEnter,
  onDelete,
  onEdit,
  onDoctorClick,
}: {
  row: RotationRow
  isHovered: boolean
  isHighlighted: boolean
  employmentPct?: number | null
  onMouseEnter: () => void
  onDelete?: () => void
  onEdit?: () => void
  onDoctorClick?: (doctorId: number) => void
}) {
  const navigate = useNavigate()
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
        'sticky left-0 z-10 flex items-center gap-1 pr-1 pl-8 py-1 border-b border-line min-w-0 transition-colors overflow-hidden',
        isOver ? '' : isHighlighted ? 'bg-accent/8' : isHovered ? 'bg-paper' : 'bg-card',
      )}
      style={{
        borderLeft: `4px solid ${isHighlighted ? color : `${color}${isHovered ? 'cc' : '80'}`}`,
        ...(isOver && { backgroundColor: `${color}20` }),
      }}
    >
      <span
        className="flex-1 text-[11px] font-medium truncate cursor-pointer text-ink min-w-0"
        onClick={(e) => { e.stopPropagation(); onDoctorClick?.(row.doctor.id) }}
        title="Arzt-Details anzeigen"
      >
        {row.doctor.name}
      </span>
      {isHovered && (
        <>
          {employmentPct != null && (
            <span className="text-[10px] text-ink-3 shrink-0 tabular-nums">{employmentPct}%</span>
          )}
          <button
            className="p-0.5 rounded hover:bg-line/40 text-ink-3 hover:text-ink-2 transition-colors shrink-0"
            title="Arzt-Profil öffnen"
            onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${row.doctor.id}`) }}
            aria-label="Arzt-Profil öffnen"
          >
            <ExternalLink className="size-3" />
          </button>
          <button
            className="p-0.5 rounded hover:bg-blue-50 text-ink-3 hover:text-blue-600 transition-colors shrink-0"
            title="Zeitraum bearbeiten"
            onClick={(e) => { e.stopPropagation(); onEdit?.() }}
            aria-label="Rotationszeitraum bearbeiten"
          >
            <Pencil className="size-3" />
          </button>
          <button
            className="p-0.5 rounded hover:bg-red-50 text-ink-3 hover:text-red-600 transition-colors shrink-0"
            title="Arzt aus Bereich entfernen"
            onClick={(e) => { e.stopPropagation(); onDelete?.() }}
            aria-label="Rotation löschen"
          >
            <X className="size-3" />
          </button>
        </>
      )}
    </div>
  )
}

export function UnifiedPlanGrid({
  departments,
  doctors = [],
  rotations,
  shifts,
  absences,
  validFrom,
  validTo,
  tarifWarningsByShift = {},
  holidayDates,
  activeFilterGroups,
  dragConflictMap,
  dragDimDays,
  selectedCellKeys,
  highlightedDoctorId,
  onCellClick,
  onRangeSelected,
  onDoubleClickRemove,
  onDoubleClickRemoveAbsence,
  onDeleteRotation,
  onEditRotation,
  onConflictDotClick,
  onTarifDotClick,
  onAddRotation,
  onDepartmentClick,
  wishes,
  showWishes,
  shiftTypes,
  onWishCreate,
  onDoctorClick,
}: UnifiedPlanGridProps) {
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const [hoverDay, setHoverDay] = useState<string | null>(null)
  const [doctorColWidth, setDoctorColWidth] = useState(180)
  const [mouseSelectState, setMouseSelectState] = useState<{
    rotationId: number
    doctorId: number
    anchorDayKey: string
    currentDayKey: string
  } | null>(null)
  const dragSelectFiredRef = useRef(false)

  const { active, over } = useDndContext()

  const days = useMemo(
    () => eachDayOfInterval({ start: parseISO(validFrom), end: parseISO(validTo) }),
    [validFrom, validTo],
  )

  const dayKeys = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days])

  const rows = useMemo(() => buildUnifiedRows(departments, rotations), [departments, rotations])

  const mouseSelectKeys = useMemo((): Set<string> => {
    if (!mouseSelectState) return new Set()
    const { rotationId, anchorDayKey, currentDayKey } = mouseSelectState
    const ai = dayKeys.indexOf(anchorDayKey)
    const ci = dayKeys.indexOf(currentDayKey)
    if (ai < 0 || ci < 0) return new Set()
    const start = Math.min(ai, ci)
    const end = Math.max(ai, ci)
    return new Set(dayKeys.slice(start, end + 1).map((dk) => `${rotationId}-${dk}`))
  }, [mouseSelectState, dayKeys])

  useEffect(() => {
    if (!mouseSelectState) return
    function handleMouseUp() {
      const state = mouseSelectState
      if (!state) return
      const { rotationId, doctorId, anchorDayKey, currentDayKey } = state
      const ai = dayKeys.indexOf(anchorDayKey)
      const ci = dayKeys.indexOf(currentDayKey)
      const start = Math.min(ai, ci)
      const end = Math.max(ai, ci)
      const range = dayKeys.slice(start, end + 1)
      if (range.length >= 2) {
        dragSelectFiredRef.current = true
        onRangeSelected?.(rotationId, doctorId, range)
      }
      setMouseSelectState(null)
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [mouseSelectState, dayKeys, onRangeSelected])

  const shiftIndex = useMemo(() => {
    const idx = new Map<string, ShiftWithDetails>()
    for (const s of shifts) {
      if (s.doctor_id != null) {
        idx.set(`${s.doctor_id}-${s.shift_date}`, s)
      }
    }
    return idx
  }, [shifts])

  const unassignedShiftByDate = useMemo(() => {
    const idx = new Map<string, ShiftWithDetails>()
    for (const s of shifts) {
      if (s.doctor_id == null && !idx.has(s.shift_date)) {
        idx.set(s.shift_date, s)
      }
    }
    return idx
  }, [shifts])

  const colCount = days.length

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
          gridTemplateColumns: `${doctorColWidth}px repeat(${colCount}, minmax(36px, 1fr))`,
        }}
      >
        {/* Kopfzeile */}
        <div className="sticky top-0 left-0 z-20 bg-[#FAF5E9] border-b border-r border-line px-3 py-2.5 flex items-end relative">
          <span className="text-[11px] text-ink-3 uppercase tracking-[0.06em] font-medium">Arzt</span>
          <div
            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent/40 transition-colors"
            onMouseDown={(e) => {
              // Listeners cleaned up on mouseup; rapid re-click not possible while dragging
              e.preventDefault()
              const startX = e.clientX
              const startW = doctorColWidth
              function onMove(ev: MouseEvent) {
                const newW = Math.max(120, Math.min(320, startW + ev.clientX - startX))
                setDoctorColWidth(newW)
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />
        </div>
        {days.map((day, i) => {
          const we = isWeekend(day)
          const tod = isToday(day)
          const dk = dayKeys[i]
          return (
            <div
              key={dk}
              data-date={dk}
              onMouseEnter={() => { setHoverDay(dk); setHoverRow(null) }}
              className={cn(
                'sticky top-0 z-10 border-b border-r border-line text-center py-[7px] px-0.5 transition-colors',
                dragDimDays?.has(dk) && 'opacity-40',
                tod ? 'bg-warn-bg' : we ? 'bg-weekend' : effectiveHoverDay === dk ? 'bg-paper/80' : 'bg-[#FAF5E9]',
              )}
            >
              <div className="text-[10px] leading-none text-ink-3">
                {WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]}
              </div>
              <div className={cn(
                'font-serif text-[16px] leading-[1.1] tabular-nums mt-0.5',
                tod ? 'text-warn-ink' : 'text-ink',
              )}>
                {day.getDate()}
              </div>
              {holidayDates?.has(dk) && (
                <span className="block text-[9px] font-medium leading-none mt-0.5 text-orange-500">
                  FT
                </span>
              )}
            </div>
          )
        })}

        {/* Daten-Zeilen */}
        {rows.flatMap((row) => {
          if (row.kind === 'header') {
            const rotationCount = rows.filter(
              (r) => r.kind === 'rotation' && r.department.id === row.department.id,
            ).length
            return [
              <BereichHeaderRow
                key={row.rowKey}
                department={row.department}
                rotationCount={rotationCount}
                onDepartmentClick={onDepartmentClick}
                onAddRotation={onAddRotation ? () => onAddRotation(row.department.id) : undefined}
              />,
            ]
          }

          if (row.kind === 'placeholder') {
            const color = getDepartmentColor(row.department)
            return [
              <div key={row.rowKey} className="contents">
                <PlaceholderLabelCell department={row.department} />
                {dayKeys.map((dk) => (
                  <div
                    key={dk}
                    className="border-b border-r border-line"
                    style={{ backgroundColor: `${color}10` }}
                  />
                ))}
              </div>,
            ]
          }

          // kind === 'rotation'
          const isRowHovered = effectiveHoverRow === row.rowKey
          const isRowHighlighted = highlightedDoctorId != null && row.doctor.id === highlightedDoctorId
          const employmentPct = isRowHovered
            ? (() => {
                const fullDoc = doctors.find((d) => d.id === row.doctor.id)
                if (!fullDoc) return null
                return getCurrentEmploymentPeriod(fullDoc.employment_periods)?.employment_percentage ?? null
              })()
            : null

          const rotationEl = (
            <div key={row.rowKey} className="contents">
              <RotationLabelCell
                row={row}
                isHovered={isRowHovered}
                isHighlighted={isRowHighlighted}
                employmentPct={employmentPct}
                onMouseEnter={() => { setHoverRow(row.rowKey); setHoverDay(null) }}
                onDelete={() => onDeleteRotation?.(row.rotation.id)}
                onEdit={() => onEditRotation?.(row.rotation)}
                onDoctorClick={onDoctorClick}
              />

              {dayKeys.map((dk) => {
                const cell = resolveCell(row, dk, shifts, absences)
                const shift = shiftIndex.get(`${row.doctor.id}-${dk}`)
                const hasConflict = (shift?.conflicts.length ?? 0) > 0
                const hasTarifWarning = shift ? (tarifWarningsByShift[shift.id]?.length ?? 0) > 0 : false
                const day = days[dayKeys.indexOf(dk)]

                const cellShiftId = shift?.id ?? unassignedShiftByDate.get(dk)?.id

                const shiftFilterGroup =
                  shift?.shift_type?.filter_group ??
                  unassignedShiftByDate.get(dk)?.shift_type?.filter_group ??
                  null

                const isConflictTarget =
                  dragConflictMap != null &&
                  !!(dragConflictMap.get(row.doctor.id)?.has(dk)) &&
                  cell.text === ''

                const cellKey = `${row.rotation.id}-${dk}`
                const isSelected = selectedCellKeys?.has(cellKey) ?? false

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
                    activeFilterGroups={activeFilterGroups}
                    shiftFilterGroup={shiftFilterGroup}
                    isHoveredRow={isRowHovered}
                    isHoveredCol={effectiveHoverDay === dk}
                    shiftId={cellShiftId}
                    isConflictTarget={isConflictTarget}
                    shiftAssigned={shift != null && shift.doctor_id != null}
                    isPinned={shift?.is_pinned ?? false}
                    isLocked={shift?.is_locked ?? false}
                    isSelected={isSelected || mouseSelectKeys.has(cellKey)}
                    isHighlightedRow={isRowHighlighted}
                    isDragDimmed={dragDimDays !== undefined && dragDimDays.has(dk)}
                    isDragHighlighted={dragDimDays !== undefined && !dragDimDays.has(dk)}
                    onMouseDown={() => {
                      setMouseSelectState({
                        rotationId: row.rotation.id,
                        doctorId: row.doctor.id,
                        anchorDayKey: dk,
                        currentDayKey: dk,
                      })
                    }}
                    onMouseEnter={() => {
                      setHoverRow(row.rowKey)
                      setHoverDay(dk)
                      if (mouseSelectState?.rotationId === row.rotation.id) {
                        setMouseSelectState((prev) => prev ? { ...prev, currentDayKey: dk } : null)
                      }
                    }}
                    onClick={(shiftKey, clickPos) => {
                      if (dragSelectFiredRef.current) {
                        dragSelectFiredRef.current = false
                        return
                      }
                      onCellClick?.(row.rotation.id, row.doctor.id, dk, shift?.id ?? null, shiftKey, clickPos)
                    }}
                    absenceId={cell.absenceId ?? undefined}
                    onDoubleClickRemove={
                      shift?.id != null
                        ? () => onDoubleClickRemove?.(shift.id)
                        : undefined
                    }
                    onDoubleClickRemoveAbsence={onDoubleClickRemoveAbsence}
                    onConflictDotClick={() => shift && onConflictDotClick?.(shift.id)}
                    onTarifDotClick={() => shift && onTarifDotClick?.(shift.id)}
                    wishHint={showWishes && row.kind === 'rotation'
                      ? getWishHint(wishes ?? [], row.doctor.id, dk)
                      : null}
                    wishBadge={showWishes && row.kind === 'rotation'
                      ? getWishBadge(wishes ?? [], row.doctor.id, dk, shiftTypes ?? [])
                      : undefined}
                    doctorId={row.doctor.id}
                    onWishCreate={onWishCreate}
                  />
                )
              })}
            </div>
          )

          return [rotationEl]
        })}
      </div>
    </div>
  )
}
