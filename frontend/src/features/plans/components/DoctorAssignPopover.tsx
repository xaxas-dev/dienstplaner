import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAssignShift } from '../useAssignShift'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useAvailabilityForDate } from '../useAvailabilityForDate'
import type { ShiftWithDetails } from '@/lib/types'

interface Props {
  planId: number
  doctorId: number
  day: string
  currentShift: ShiftWithDetails | null
  openShiftsForDay: ShiftWithDetails[]
  onClose: () => void
}

export function DoctorAssignPopover({
  planId, doctorId, day, currentShift, openShiftsForDay, onClose,
}: Props) {
  const { mutate, isPending } = useAssignShift(planId)
  const { data: doctors = [] } = useDoctors()
  const [search, setSearch] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  const activeDoctorIds = doctors.filter((d) => d.active).map((d) => d.id)
  const availabilityMap = useAvailabilityForDate(activeDoctorIds, day)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function assign(shiftId: number, newDoctorId: number | null) {
    mutate(
      { shiftId, data: { doctor_id: newDoctorId } },
      {
        onSuccess: () => {
          toast.success(newDoctorId ? 'Zuweisung gespeichert' : 'Zuweisung entfernt')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
        },
      },
    )
  }

  const filteredDoctors = doctors.filter(
    (d) => d.active && d.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-lg w-72 p-4 space-y-3"
      >
        {/* Offene Schichten */}
        {openShiftsForDay.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium">Schicht auswählen</p>
            <div className="flex flex-wrap gap-1.5">
              {openShiftsForDay.map((s) => (
                <button
                  key={s.id}
                  disabled={isPending}
                  onClick={() => assign(s.id, doctorId)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
                >
                  {s.shift_type?.short_name ?? s.shift_type_id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anderen Arzt zuweisen (nur bei besetzter Zelle) */}
        {currentShift && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium">Anderen Arzt zuweisen</p>
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
            <ul className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredDoctors.map((d) => {
                const avail = availabilityMap[d.id]
                const unavailable = avail !== undefined && !avail.available
                const tooltip = unavailable ? avail.reasons.join(', ') : undefined
                return (
                  <li key={d.id}>
                    <button
                      disabled={isPending}
                      onClick={() => assign(currentShift.id, d.id)}
                      title={tooltip}
                      className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-paper transition flex items-center gap-1.5"
                    >
                      {unavailable && (
                        <span
                          aria-label="Nicht INA-verfügbar"
                          className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                        />
                      )}
                      <span>{d.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Zuweisung entfernen */}
        {currentShift && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-warn-ink hover:bg-warn-bg text-xs"
            disabled={isPending}
            onClick={() => assign(currentShift.id, null)}
          >
            Zuweisung entfernen
          </Button>
        )}

        {openShiftsForDay.length === 0 && !currentShift && (
          <p className="text-xs text-ink-3">Keine offenen Schichten an diesem Tag.</p>
        )}
      </div>
    </div>
  )
}
