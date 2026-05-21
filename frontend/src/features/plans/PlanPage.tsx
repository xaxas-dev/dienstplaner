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
import { CommandBar } from '@/components/dp/CommandBar'
import { KpiBar } from '@/components/dp/KpiBar'
import { usePlan } from './usePlans'
import { usePlanShifts } from './usePlanShifts'
import { usePlanConflicts } from './usePlanConflicts'
import { usePlanRotations } from './usePlanRotations'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useDepartments } from '@/features/departments/useDepartments'
import { PlanGrid } from './components/PlanGrid'
import { ContextPanel } from './components/ContextPanel'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
import { DoctorDragSource, DoctorDragOverlayToken, parseDoctorDragId } from './components/DoctorDragSource'
import { RotationGrid, parseRotationDropId } from './components/RotationGrid'
import { RotationAssignPopover } from './components/RotationAssignPopover'
import type { ShiftWithDetails } from '@/lib/types'

interface ActiveCell {
  shiftId: number | null
  doctorId: number
  day: string
}

export function PlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const id = Number(planId)

  const [view, setView] = useState<'bereiche' | 'dienste'>('bereiche')
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)
  const [activeRotationCell, setActiveRotationCell] = useState<{
    departmentId: number
    day: string
    assignmentId: number | null
  } | null>(null)
  const [preselectedDragDoctorId, setPreselectedDragDoctorId] = useState<number | null>(null)
  const [activeDragDoctor, setActiveDragDoctor] = useState<{ id: number; name: string } | null>(null)
  const [rotationPreview, setRotationPreview] = useState<{
    departmentId: number
    doctorId: number
    doctorName: string
    dateFrom: string
    dateTo: string
  } | null>(null)

  const { data: plan } = usePlan(id)
  const { data: shifts = [], isError: shiftsError } = usePlanShifts(id)
  const { data: conflicts } = usePlanConflicts(id)
  const { data: doctors = [] } = useDoctors()
  const { data: departments = [] } = useDepartments()
  const { data: rotations = [] } = usePlanRotations(id)

  useEffect(() => {
    if (shiftsError) {
      toast.error('Plan nicht gefunden')
      navigate('/plans')
    }
  }, [shiftsError, navigate])

  useEffect(() => {
    setActiveCell(null)
    setActiveRotationCell(null)
    setContextShift(null)
    setPreselectedDragDoctorId(null)
    setRotationPreview(null)
  }, [view])

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

  function handleCellClick(shiftId: number | null, doctorId: number, day: string) {
    setContextShift(null)
    setActiveCell({ shiftId, doctorId, day })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    const doctorId = parseDoctorDragId(String(event.active.id))
    if (doctorId === null) return
    const name = (event.active.data.current as { doctorName?: string } | undefined)?.doctorName ?? ''
    setActiveDragDoctor({ id: doctorId, name })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragDoctor(null)
    const { active, over } = event
    if (!over) return
    const doctorId = parseDoctorDragId(String(active.id))
    if (doctorId === null) return
    const target = parseRotationDropId(String(over.id))
    if (target === null) return
    setPreselectedDragDoctorId(doctorId)
    setActiveRotationCell({ departmentId: target.departmentId, day: target.day, assignmentId: null })
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
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Arzt'
            return `${name} wird gezogen.`
          },
          onDragOver({ active, over }) {
            if (!over) return
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Arzt'
            const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Bereich'
            return `${name} über ${dept}.`
          },
          onDragEnd({ active, over }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Arzt'
            if (over) {
              const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Bereich'
              return `${name} auf ${dept} abgelegt.`
            }
            return `${name}-Drag abgebrochen.`
          },
          onDragCancel({ active }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Arzt'
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
      />
      <div className="px-6 py-3">
        <KpiBar tiles={kpiTiles} />
      </div>
      <div className="px-6 pb-2 flex gap-1">
        {(['bereiche', 'dienste'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              'px-3 py-1 rounded-lg text-xs font-medium transition capitalize',
              view === v
                ? 'border-b-2 border-accent text-ink'
                : 'text-ink-3 hover:bg-paper',
            ].join(' ')}
          >
            {v === 'dienste' ? 'Dienste' : 'Bereiche'}
          </button>
        ))}
      </div>
      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        {view === 'bereiche' && (
          <DoctorDragSource doctors={doctors} />
        )}
        <div className="flex flex-1 min-w-0 overflow-hidden rounded-2xl border border-line bg-card">
          {view === 'dienste' && plan && (
            <PlanGrid
              shifts={shifts}
              doctors={doctors}
              validFrom={plan.valid_from}
              validTo={plan.valid_to}
              onCellClick={handleCellClick}
              onConflictDotClick={(shift) => {
                setActiveCell(null)
                setContextShift(shift)
              }}
            />
          )}
          {view === 'bereiche' && plan && (
            <RotationGrid
              rotations={rotations}
              departments={departments}
              validFrom={plan.valid_from}
              validTo={plan.valid_to}
              onCellClick={(departmentId, day, assignmentId) =>
                setActiveRotationCell({ departmentId, day, assignmentId })
              }
              preview={rotationPreview}
            />
          )}
        </div>
        {contextShift && (
          <ContextPanel
            shift={contextShift}
            onClose={() => setContextShift(null)}
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
      {view === 'bereiche' && activeRotationCell && (() => {
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
          <DoctorDragOverlayToken name={activeDragDoctor.name} id={activeDragDoctor.id} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
