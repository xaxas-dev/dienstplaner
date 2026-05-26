import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core'

// Cursor-Hotspot am Avatar-Top: x zentriert (14 = half of 28px), y = 0
const avatarTopModifier: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform
  const offsetX = activatorEvent.clientX - draggingNodeRect.left
  const offsetY = activatorEvent.clientY - draggingNodeRect.top
  return { ...transform, x: transform.x + offsetX - 14, y: transform.y + offsetY }
}
import { FileDown } from 'lucide-react'
import { CommandBar } from '@/components/dp/CommandBar'
import { KpiBar } from '@/components/dp/KpiBar'
import { usePlan } from './usePlans'
import { usePlanShifts } from './usePlanShifts'
import { usePlanConflicts } from './usePlanConflicts'
import { usePlanRotations } from './usePlanRotations'
import { useDoctorAvailability } from './useDoctorAvailability'
import { useTarifWarnings } from './useTarifWarnings'
import { usePlanAbsences } from './usePlanAbsences'
import { useAssignShift, findShiftId } from './useAssignShift'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useDepartments } from '@/features/departments/useDepartments'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import { UnifiedPlanGrid } from './components/UnifiedPlanGrid'
import { ShiftTypeDragBar, parseShiftTypeDragId } from './components/ShiftTypeDragBar'
import { ContextPanel } from './components/ContextPanel'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
import { DoctorDragSource, DoctorDragOverlayToken, parseDoctorDragId } from './components/DoctorDragSource'
import { RotationAssignPopover } from './components/RotationAssignPopover'
import { parseBereichHeaderDropId } from './components/BereichHeaderRow'
import type { ShiftWithDetails, TarifWarning } from '@/lib/types'

interface ActiveCell {
  rotationId: number
  doctorId: number
  day: string
  shiftId: number | null
}

export function PlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const id = Number(planId)

  const [focusMode, setFocusMode] = useState<'alle' | 'vn'>('alle')
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)
  const [activeRotationCell, setActiveRotationCell] = useState<{
    departmentId: number
    day: string
    assignmentId: number | null
  } | null>(null)
  const [preselectedDragDoctorId, setPreselectedDragDoctorId] = useState<number | null>(null)
  const [activeDragDoctor, setActiveDragDoctor] = useState<{
    id: number
    name: string
    shortName?: string | null
  } | null>(null)
  const [rotationPreview, setRotationPreview] = useState<{
    departmentId: number
    doctorId: number
    doctorName: string
    doctorShortName?: string | null
    dateFrom: string
    dateTo: string
  } | null>(null)

  const { data: plan } = usePlan(id)
  const { data: shifts = [], isError: shiftsError } = usePlanShifts(id)
  const { data: conflicts } = usePlanConflicts(id)
  const { data: doctors = [] } = useDoctors()
  const { data: departments = [] } = useDepartments()
  const { data: rotations = [] } = usePlanRotations(id)
  const { data: absences = [] } = usePlanAbsences(id)
  const { data: shiftTypes = [] } = useShiftTypes()
  const { data: dragAvailability } = useDoctorAvailability(
    activeDragDoctor?.id ?? null,
    plan?.valid_from ?? null,
    plan?.valid_to ?? null,
  )
  const { data: tarifWarningsData } = useTarifWarnings(id)
  const assignShift = useAssignShift(id)

  const tarifWarningsByShift: Record<number, TarifWarning[]> = {}
  for (const w of tarifWarningsData?.warnings ?? []) {
    if (w.shift_id != null) {
      ;(tarifWarningsByShift[w.shift_id] ??= []).push(w)
    }
  }

  useEffect(() => {
    if (shiftsError) {
      toast.error('Plan nicht gefunden')
      navigate('/plans')
    }
  }, [shiftsError, navigate])

  const planTitle = plan
    ? format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
    : '…'

  const kpiTiles = [
    { label: 'Ärzte', value: doctors.length },
    { label: 'Schichten', value: shifts.length },
    {
      label: 'Offen',
      value: conflicts?.open_shift_count ?? 0,
      tone: (conflicts?.open_shift_count ?? 0) > 0
        ? ('warn' as const)
        : ('default' as const),
    },
    {
      label: 'Konflikte',
      value: conflicts?.conflict_count ?? 0,
      tone: (conflicts?.conflict_count ?? 0) > 0
        ? ('warn' as const)
        : ('default' as const),
    },
  ]

  function handleCellClick(rotationId: number, doctorId: number, day: string, shiftId: number | null) {
    setContextShift(null)
    setActiveCell({ rotationId, doctorId, day, shiftId })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    const doctorId = parseDoctorDragId(String(event.active.id))
    if (doctorId === null) return
    const doctor = doctors.find((d) => d.id === doctorId)
    const name = (event.active.data.current as { doctorName?: string } | undefined)?.doctorName ?? doctor?.name ?? ''
    setActiveDragDoctor({ id: doctorId, name, shortName: doctor?.short_name })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragDoctor(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // ── Doctor → Bereich-Header-Drop ──────────────────────────────────────────
    const doctorId = parseDoctorDragId(activeId)
    if (doctorId !== null) {
      const deptId = parseBereichHeaderDropId(overId)
      if (deptId !== null) {
        setPreselectedDragDoctorId(doctorId)
        setActiveRotationCell({ departmentId: deptId, day: plan?.valid_from ?? '', assignmentId: null })
      }
      return
    }

    // ── ShiftType → Cell-Drop ─────────────────────────────────────────────────
    const shiftTypeId = parseShiftTypeDragId(activeId)
    if (shiftTypeId === null) return

    // Ziel-Zelle parsen: cell-{rotationId}-{yyyy-MM-dd}
    const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
    if (!cellMatch) return
    const rotationId = Number(cellMatch[1])
    const dayKey = cellMatch[2]

    // Arzt aus Rotation ermitteln
    const rotation = rotations.find((r) => r.id === rotationId)
    if (!rotation) return
    const targetDoctorId = rotation.doctor_id

    // Shift für diesen Tag + ShiftType suchen
    const shiftId = findShiftId(shifts, dayKey, shiftTypeId)
    if (shiftId === null) {
      const st = shiftTypes.find((s) => s.id === shiftTypeId)
      toast.error(`${st?.short_name ?? 'Dienst'} ist an diesem Tag nicht verfügbar`)
      return
    }

    const shift = shifts.find((s) => s.id === shiftId)!
    if (shift.is_pinned) {
      toast.error('Dienst ist gepinnt — Pin zuerst entfernen')
      return
    }

    if (shift.doctor_id != null && shift.doctor_id !== targetDoctorId) {
      const prevDoctor = doctors.find((d) => d.id === shift.doctor_id)
      const newDoctor = doctors.find((d) => d.id === targetDoctorId)
      const confirmed = window.confirm(
        `${prevDoctor?.name ?? 'Anderer Arzt'} wird durch ${newDoctor?.name ?? 'Arzt'} ersetzt. Fortfahren?`,
      )
      if (!confirmed) return
    }

    assignShift.mutate(
      { shiftId, data: { doctor_id: targetDoctorId } },
      { onError: () => toast.error('Fehler beim Speichern der Zuweisung') },
    )
  }

  function handleDragCancel() {
    setActiveDragDoctor(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            return `${name} wird gezogen.`
          },
          onDragOver({ active, over }) {
            if (!over) return
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Bereich'
            return `${name} über ${dept}.`
          },
          onDragEnd({ active, over }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            if (over) {
              const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Ziel'
              return `${name} auf ${dept} abgelegt.`
            }
            return `${name}-Drag abgebrochen.`
          },
          onDragCancel({ active }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            return `${name}-Drag abgebrochen.`
          },
        },
        screenReaderInstructions: {
          draggable: 'Zum Ziehen: Leertaste oder Enter. Pfeiltasten navigieren. Leertaste oder Enter legt ab. Escape bricht ab.',
        },
      }}
    >
    <div className="flex flex-col flex-1 overflow-hidden">
      <CommandBar
        title={planTitle}
        breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
        primaryAction={
          !isNaN(id)
            ? {
                label: 'Exportieren',
                icon: FileDown,
                onClick: () => window.location.assign(`/api/plans/${id}/export`),
              }
            : undefined
        }
      />
      <div className="px-6 py-3">
        <KpiBar tiles={kpiTiles} />
      </div>

      {/* ShiftType-DragBar + Fokus-Toggle */}
      <div className="px-6 pb-2 flex items-center gap-3">
        <div className="flex-1">
          <ShiftTypeDragBar shiftTypes={shiftTypes} focusMode={focusMode} />
        </div>
        <button
          onClick={() => setFocusMode((m) => (m === 'alle' ? 'vn' : 'alle'))}
          className={[
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
            focusMode === 'vn'
              ? 'bg-accent text-white border-accent'
              : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
          ].join(' ')}
        >
          {focusMode === 'vn' ? 'Fokus: V+N' : 'Alle Dienste'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        <DoctorDragSource doctors={doctors} />
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {plan && (
            <UnifiedPlanGrid
              departments={departments}
              rotations={rotations}
              shifts={shifts}
              absences={absences}
              validFrom={plan.valid_from}
              validTo={plan.valid_to}
              tarifWarningsByShift={tarifWarningsByShift}
              focusMode={focusMode}
              onCellClick={handleCellClick}
              onConflictDotClick={(shiftId) => {
                const shift = shifts.find((s) => s.id === shiftId) ?? null
                setActiveCell(null)
                setContextShift(shift)
              }}
              onTarifDotClick={(shiftId) => {
                const shift = shifts.find((s) => s.id === shiftId) ?? null
                setActiveCell(null)
                setContextShift(shift)
              }}
            />
          )}
        </div>
        {contextShift && (
          <ContextPanel
            shift={contextShift}
            onClose={() => setContextShift(null)}
            tarifWarnings={tarifWarningsByShift[contextShift.id]}
          />
        )}
      </div>

      {activeCell && (
        <DoctorAssignPopover
          planId={id}
          doctorId={activeCell.doctorId}
          day={activeCell.day}
          currentShift={shifts.find((s) => s.id === activeCell.shiftId) ?? null}
          openShiftsForDay={shifts.filter(
            (s) =>
              s.shift_date === activeCell.day &&
              (s.doctor_id === null || s.doctor_id === undefined),
          )}
          onClose={() => setActiveCell(null)}
        />
      )}

      {activeRotationCell && (() => {
        const dept = departments.find(d => d.id === activeRotationCell.departmentId)
        const existing = activeRotationCell.assignmentId
          ? rotations.find(r => r.id === activeRotationCell.assignmentId) ?? null
          : null
        return dept ? (
          <RotationAssignPopover
            planId={id}
            departmentId={activeRotationCell.departmentId}
            departmentName={dept.name}
            day={activeRotationCell.day}
            validTo={plan!.valid_to}
            existingAssignment={existing}
            blocksIna={dept.blocks_ina_weekdays || dept.blocks_ina_weekends}
            preselectedDoctorId={preselectedDragDoctorId ?? undefined}
            onPreviewChange={(preview) => {
              if (preview === null) {
                setRotationPreview(null)
                return
              }
              const doctor = doctors.find((d) => d.id === preview.doctorId)
              if (!doctor) return
              setRotationPreview({
                departmentId: activeRotationCell.departmentId,
                doctorId: doctor.id,
                doctorName: doctor.name,
                doctorShortName: doctor.short_name,
                dateFrom: preview.dateFrom,
                dateTo: preview.dateTo,
              })
            }}
            onClose={() => {
              setActiveRotationCell(null)
              setPreselectedDragDoctorId(null)
              setRotationPreview(null)
            }}
          />
        ) : null
      })()}
    </div>
      <DragOverlay modifiers={[avatarTopModifier]}>
        {activeDragDoctor && (
          <DoctorDragOverlayToken
            name={activeDragDoctor.name}
            shortName={activeDragDoctor.shortName}
            id={activeDragDoctor.id}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
