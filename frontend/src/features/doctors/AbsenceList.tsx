import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAbsences, useDeleteAbsence } from './useAbsences'
import { AbsenceFormDialog } from './AbsenceFormDialog'
import { formatDate } from './doctorHelpers'
import type { Absence, AbsenceType } from '@/lib/types'

const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB: 'Urlaub',
  KRANKHEIT: 'Krankheit',
  FORTBILDUNG: 'Fortbildung',
  ELTERNZEIT: 'Elternzeit',
  MUTTERSCHUTZ: 'Mutterschutz',
  SONSTIGES: 'Sonstiges',
  EINARBEITUNG: 'Einarbeitung',
  EINARBEITUNG_INA: 'Einarbeitung INA',
  UNBESETZT: 'Station unbesetzt',
}

const ABSENCE_TYPE_VARIANTS: Record<AbsenceType, 'default' | 'secondary' | 'outline'> = {
  URLAUB: 'default',
  KRANKHEIT: 'secondary',
  FORTBILDUNG: 'outline',
  ELTERNZEIT: 'secondary',
  MUTTERSCHUTZ: 'secondary',
  SONSTIGES: 'outline',
  EINARBEITUNG: 'outline',
  EINARBEITUNG_INA: 'outline',
  UNBESETZT: 'secondary',
}

interface AbsenceListProps {
  doctorId: number
}

export function AbsenceList({ doctorId }: AbsenceListProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editAbsence, setEditAbsence] = useState<Absence | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null)

  const { data: absences = [], isLoading } = useAbsences(doctorId)
  const deleteMutation = useDeleteAbsence(doctorId)

  const sorted = [...absences].sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  const handleEdit = (absence: Absence) => {
    setEditAbsence(absence)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditAbsence(undefined)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Abwesenheit gelöscht')
        setDeleteTarget(null)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Abwesenheiten
        </h3>
        <Button size="sm" variant="outline" onClick={handleNew}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Neue Abwesenheit
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Keine Abwesenheiten hinterlegt.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((absence) => (
          <div
            key={absence.id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Badge variant={ABSENCE_TYPE_VARIANTS[absence.absence_type]}>
                {ABSENCE_TYPE_LABELS[absence.absence_type] ?? absence.absence_type}
              </Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatDate(absence.valid_from)} &ndash; {formatDate(absence.valid_to)}
                </p>
                {absence.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {absence.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(absence)}
                aria-label="Bearbeiten"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteTarget(absence)}
                aria-label="Löschen"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AbsenceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditAbsence(undefined)
        }}
        doctorId={doctorId}
        absence={editAbsence}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abwesenheit löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
