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
import { useDoctors } from '@/features/doctors/useDoctors'
import { PlanGrid } from './components/PlanGrid'
import { ContextPanel } from './components/ContextPanel'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
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

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)

  const { data: plan } = usePlan(id)
  const { data: shifts = [], isError: shiftsError } = usePlanShifts(id)
  const { data: conflicts } = usePlanConflicts(id)
  const { data: doctors = [] } = useDoctors()

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
      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        {plan && (
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
    </div>
  )
}
