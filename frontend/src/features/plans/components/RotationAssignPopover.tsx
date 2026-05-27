import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateRotation, useUpdateRotation, useDeleteRotation } from '../usePlanRotations'
import { useDoctors } from '@/features/doctors/useDoctors'
import type { RotationAssignmentWithDetails } from '@/lib/types'

interface Props {
  planId: number
  departmentId: number
  departmentName: string
  day: string
  validTo: string
  existingAssignment: RotationAssignmentWithDetails | null
  blocksIna: boolean
  preselectedDoctorId?: number
  onClose: () => void
}

export function RotationAssignPopover({
  planId,
  departmentId,
  departmentName,
  day,
  validTo,
  existingAssignment,
  blocksIna,
  preselectedDoctorId,
  onClose,
}: Props) {
  const { mutate: createMutate, isPending: isCreating } = useCreateRotation(planId)
  const { mutate: updateMutate, isPending: isUpdating } = useUpdateRotation(planId)
  const { mutate: deleteMutate, isPending: isDeleting } = useDeleteRotation(planId)
  const { data: doctors = [] } = useDoctors()

  const [search, setSearch] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(
    existingAssignment?.doctor_id ?? preselectedDoctorId ?? null,
  )
  const [dateFrom, setDateFrom] = useState(existingAssignment?.valid_from ?? day)
  const [dateTo, setDateTo] = useState(existingAssignment?.valid_to ?? validTo)
  const [isEinarbeitung, setIsEinarbeitung] = useState(
    existingAssignment?.is_einarbeitung ?? false,
  )
  const [showDoctorPicker, setShowDoctorPicker] = useState(
    preselectedDoctorId == null && existingAssignment == null,
  )

  const cardRef = useRef<HTMLDivElement>(null)

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

  const isPending = isCreating || isUpdating || isDeleting

  const filteredDoctors = doctors.filter(
    (d) => d.active && d.name.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedDoctorName = doctors.find((d) => d.id === selectedDoctorId)?.name

  function handleSave() {
    if (selectedDoctorId === null) return

    if (existingAssignment) {
      updateMutate(
        {
          rotationId: existingAssignment.id,
          data: {
            doctor_id: selectedDoctorId,
            valid_from: dateFrom,
            valid_to: dateTo,
            is_einarbeitung: isEinarbeitung,
          },
        },
        {
          onSuccess: () => {
            toast.success('Zuordnung gespeichert')
            onClose()
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
          },
        },
      )
    } else {
      createMutate(
        {
          plan_id: planId,
          doctor_id: selectedDoctorId,
          department_id: departmentId,
          valid_from: dateFrom,
          valid_to: dateTo,
          is_einarbeitung: isEinarbeitung,
        },
        {
          onSuccess: () => {
            toast.success('Zuordnung gespeichert')
            onClose()
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
          },
        },
      )
    }
  }

  function handleDelete() {
    if (!existingAssignment) return
    deleteMutate(existingAssignment.id, {
      onSuccess: () => {
        toast.success('Zuordnung entfernt')
        onClose()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Fehler beim Entfernen')
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-lg w-80 p-4 space-y-3"
      >
        {/* Bereich-Label */}
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">{departmentName}</p>

        {/* Ausgewählter Arzt */}
        <div className="space-y-1.5">
          {selectedDoctorId !== null ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-lg border border-line">
              <span className="text-sm font-semibold text-ink flex-1 truncate">
                {selectedDoctorName}
              </span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg border border-dashed border-line text-xs text-muted-foreground italic">
              Kein Arzt ausgewählt
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDoctorPicker((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-2 border border-line rounded-md px-2 py-1 bg-paper hover:bg-paper/70 transition-colors"
          >
            {showDoctorPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {selectedDoctorId !== null ? 'Anderen Arzt auswählen' : 'Arzt auswählen'}
          </button>

          {showDoctorPicker && (
            <div className="space-y-1.5 border border-line rounded-lg p-2">
              <Input
                placeholder="Suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <ul className="max-h-36 overflow-y-auto space-y-0.5">
                {filteredDoctors.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setSelectedDoctorId(d.id)
                        setShowDoctorPicker(false)
                        setSearch('')
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition ${
                        selectedDoctorId === d.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-paper'
                      }`}
                    >
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Zeitraum */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-ink-3">Von</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-7 text-xs border border-line rounded-md px-2 bg-paper"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-ink-3">Bis</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-7 text-xs border border-line rounded-md px-2 bg-paper"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Einarbeitung */}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isEinarbeitung}
            onChange={(e) => setIsEinarbeitung(e.target.checked)}
            disabled={isPending}
            className="rounded"
          />
          Einarbeitung
        </label>

        {/* INA-Hinweis */}
        {blocksIna && (
          <p className="text-[10px] text-warn-ink">
            Rotation in diesem Bereich sperrt INA-Dienste (V/T/N).
          </p>
        )}

        <Button
          size="sm"
          className="w-full"
          disabled={isPending || selectedDoctorId === null}
          onClick={handleSave}
        >
          Speichern
        </Button>

        {existingAssignment !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-warn-ink hover:bg-warn-bg text-xs"
            disabled={isPending}
            onClick={handleDelete}
          >
            Zuordnung entfernen
          </Button>
        )}
      </div>
    </div>
  )
}
