import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
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
import { RotationGrid } from './components/RotationGrid'
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

  const [view, setView] = useState<'dienste' | 'bereiche'>('dienste')
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)
  const [activeRotationCell, setActiveRotationCell] = useState<{
    departmentId: number
    day: string
    assignmentId: number | null
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <CommandBar
        title={planTitle}
        breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
      />
      <div className="px-6 py-3">
        <KpiBar tiles={kpiTiles} />
      </div>
      <div className="px-6 pb-2 flex gap-1">
        {(['dienste', 'bereiche'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              'px-3 py-1 rounded-lg text-xs font-medium transition capitalize',
              view === v
                ? 'bg-accent text-white'
                : 'text-ink-3 hover:bg-paper',
            ].join(' ')}
          >
            {v === 'dienste' ? 'Dienste' : 'Bereiche'}
          </button>
        ))}
      </div>
      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
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
            onClose={() => setActiveRotationCell(null)}
          />
        ) : null
      })()}
    </div>
  )
}
