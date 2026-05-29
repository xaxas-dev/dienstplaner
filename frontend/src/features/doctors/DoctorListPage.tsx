import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CommandBar } from '@/components/dp/CommandBar'
import { DoctorCard } from './DoctorCard'
import { useDoctors } from './useDoctors'
import { useCurrentPlan } from '@/features/today/useCurrentPlan'
import { usePlanShifts } from '@/features/plans/usePlanShifts'
import type { Doctor, ShiftWithDetails } from '@/lib/types'

type FilterKey = 'all' | 'facharzt' | 'wba' | 'extern'

function applyFilter(doctors: Doctor[], filter: FilterKey): Doctor[] {
  switch (filter) {
    case 'facharzt': return doctors.filter((d) => d.is_facharzt)
    case 'wba':      return doctors.filter((d) => d.weiterbildungsjahr != null)
    case 'extern':   return doctors.filter((d) => d.doctor_type === 'EXTERNAL')
    default:         return doctors
  }
}

export function DoctorListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [includeInactive, setIncludeInactive] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const { data: doctors, isLoading, isError, refetch } = useDoctors(includeInactive)
  const { data: currentPlan } = useCurrentPlan(today)
  const { data: planShifts } = usePlanShifts(currentPlan?.id ?? NaN)

  const shiftsByDoctor = useMemo<Record<number, ShiftWithDetails[]>>(() => {
    if (!planShifts) return {}
    const map: Record<number, ShiftWithDetails[]> = {}
    for (const shift of planShifts) {
      if (shift.doctor_id == null) continue
      ;(map[shift.doctor_id] ??= []).push(shift)
    }
    return map
  }, [planShifts])

  const sorted = [...(doctors ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const visible = applyFilter(sorted, filter)
  const totalCount = doctors?.length ?? 0
  const count = visible.length

  const filterChips = [
    { label: 'Alle',      active: filter === 'all',      onClick: () => setFilter('all') },
    { label: 'Fachärzte', active: filter === 'facharzt', onClick: () => setFilter('facharzt') },
    { label: 'WBA',       active: filter === 'wba',      onClick: () => setFilter('wba') },
    { label: 'Extern',    active: filter === 'extern',   onClick: () => setFilter('extern') },
    {
      label: includeInactive ? 'Inaktive ausblenden' : 'Inaktive anzeigen',
      active: includeInactive,
      onClick: () => setIncludeInactive((v) => !v),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        titleAccent="Team"
        title={count > 0 ? `· ${count} Ärzte` : ''}
        filters={filterChips}
        primaryAction={{
          label: '+ Neuer Arzt',
          onClick: () => void navigate('/doctors/new'),
        }}
        showSearch
      />

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        {isLoading && (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-card border border-line h-11 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive">Daten konnten nicht geladen werden.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Erneut versuchen
            </Button>
          </div>
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            {totalCount === 0 ? (
              <>
                <p className="text-sm">Noch keine Ärzte angelegt.</p>
                <Button variant="accent" size="sm" onClick={() => void navigate('/doctors/new')}>
                  + Neuer Arzt
                </Button>
              </>
            ) : (
              <p className="text-sm">Keine Ärzte für diesen Filter.</p>
            )}
          </div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {visible.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                doctorShifts={shiftsByDoctor[doctor.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
