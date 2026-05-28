import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { planAbsenceKeys } from '../usePlanAbsences'
import type { AbsenceType, Absence } from '@/lib/types'

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  URLAUB:       'U — Urlaub',
  KRANKHEIT:    'K — Krankheit',
  FORTBILDUNG:  'FB — Fortbildung',
  ELTERNZEIT:   'EZ — Elternzeit',
  MUTTERSCHUTZ: 'MuSchu — Mutterschutz',
  SONSTIGES:    'EA — Sonstiges',
}

interface AbsenceAssignPopoverProps {
  doctorId: number
  doctorName: string
  absenceType: AbsenceType
  defaultFrom: string  // ISO date 'yyyy-MM-dd'
  planId: number
  onClose: () => void
}

export function AbsenceAssignPopover({
  doctorId,
  doctorName,
  absenceType,
  defaultFrom,
  planId,
  onClose,
}: AbsenceAssignPopoverProps) {
  const [validFrom, setValidFrom] = useState(defaultFrom)
  const [validTo, setValidTo] = useState('')
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: { doctor_id: number; absence_type: AbsenceType; valid_from: string; valid_to: string; notes?: string }) =>
      apiPost<Absence>(`/api/doctors/${doctorId}/absences`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      qc.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Abwesenheit eingetragen')
      onClose()
    },
    onError: () => {
      toast.error('Fehler beim Speichern der Abwesenheit')
    },
  })

  // ESC schließt
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validTo) return
    mutation.mutate({
      doctor_id: doctorId,
      absence_type: absenceType,
      valid_from: validFrom,
      valid_to: validTo,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-80 rounded-xl border border-line bg-card shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-line">
          <div className="text-[13px] font-semibold text-ink">Abwesenheit eintragen</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{doctorName}</div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 flex flex-col gap-3">
          {/* Typ Badge (read-only) */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Typ</div>
            <span className="px-2.5 py-1 rounded-md border border-[#d4c8b4] text-[11px] font-semibold bg-[#FFF8F0] text-[#7a5c3a]">
              {ABSENCE_LABELS[absenceType]}
            </span>
          </div>

          {/* Von / Bis */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Von
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-line bg-paper text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Bis <span className="text-accent">*</span>
              </label>
              <input
                type="date"
                value={validTo}
                min={validFrom}
                onChange={(e) => setValidTo(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-md border text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ borderColor: !validTo ? '#C66A3D' : undefined }}
              />
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Notizen <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-md border border-line bg-card text-[12px] text-ink resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="…"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink-3 bg-paper hover:bg-paper/80 transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!validTo || mutation.isPending}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
