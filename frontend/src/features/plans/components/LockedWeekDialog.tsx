import * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateLockedWeek } from '../useCreateLockedWeek'
import type { Doctor, ShiftType } from '@/lib/types'

interface LockedWeekDialogProps {
  open: boolean
  onClose: () => void
  planId: number
  doctors: Doctor[]
  shiftTypes: ShiftType[]
}

export function LockedWeekDialog({
  open,
  onClose,
  planId,
  doctors,
  shiftTypes,
}: LockedWeekDialogProps) {
  const [doctorId, setDoctorId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [shiftTypeId, setShiftTypeId] = useState<string>('')

  const mutation = useCreateLockedWeek(planId)

  function handleClose() {
    onClose()
    setDoctorId('')
    setStartDate('')
    setShiftTypeId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!doctorId || !startDate || !shiftTypeId) {
      toast.error('Alle Felder sind Pflichtfelder.')
      return
    }

    const parsed = new Date(startDate + 'T00:00:00')
    if (parsed.getDay() !== 0) {
      toast.error('Startdatum muss ein Sonntag sein.')
      return
    }

    mutation.mutate(
      {
        doctor_id: parseInt(doctorId),
        start_date: startDate,
        shift_type_id: parseInt(shiftTypeId),
      },
      {
        onSuccess: (result) => {
          if (result.skipped.length > 0) {
            toast.success(
              `Nachtdienstwoche eingetragen. ${result.skipped.length} Schicht(en) bereits vorhanden, übersprungen.`,
            )
          } else {
            toast.success('Nachtdienstwoche eingetragen.')
          }
          handleClose()
        },
        onError: () => {
          toast.error('Fehler beim Eintragen der Nachtdienstwoche.')
        },
      },
    )
  }

  const activeDoctors = doctors.filter((d) => d.active)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nachtdienstwoche eintragen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="lw-doctor">Arzt</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger id="lw-doctor">
                <SelectValue placeholder="Arzt wählen…" />
              </SelectTrigger>
              <SelectContent>
                {activeDoctors.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}{d.short_name ? ` (${d.short_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lw-date">Startdatum (Sonntag)</Label>
            <input
              id="lw-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
            <p className="text-xs text-muted-foreground">
              Muss ein Sonntag sein (So–Do wird erzeugt).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lw-shifttype">Schichttyp</Label>
            <Select value={shiftTypeId} onValueChange={setShiftTypeId}>
              <SelectTrigger id="lw-shifttype">
                <SelectValue placeholder="Schichttyp wählen…" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.short_name} — {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button type="submit" variant="accent" disabled={mutation.isPending}>
              {mutation.isPending ? 'Wird eingetragen…' : 'Eintragen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
