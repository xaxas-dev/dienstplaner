import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  useDoctorConstraintOverrides,
  useDeleteDoctorConstraintOverride,
} from './useDoctorConstraintOverrides'
import { ConstraintOverrideFormDialog } from './ConstraintOverrideFormDialog'

const CONSTRAINT_LABELS: Record<string, string> = {
  'max-bd-per-month': 'Max. BD/Monat',
  'max-weekends-per-month': 'Max. Wochenende/Monat',
  'min-rest-time': 'Mindestruhezeit',
  'max-weekly-hours': 'Max. Wochenstunden',
}

interface Props {
  doctorId: number
}

export function ConstraintOverrideList({ doctorId }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const { data: overrides = [], isLoading } = useDoctorConstraintOverrides(doctorId)
  const deleteMutation = useDeleteDoctorConstraintOverride(doctorId)

  const handleDelete = () => {
    if (deleteTarget == null) return
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success('Override gelöscht')
        setDeleteTarget(null)
      },
      onError: () => {
        toast.error('Löschen fehlgeschlagen')
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Constraint-Overrides
        </h3>
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Neuer Override
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
      )}
      {!isLoading && overrides.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Keine Constraint-Overrides hinterlegt.
        </p>
      )}

      <div className="space-y-2">
        {overrides.map((o) => {
          const toStr = o.valid_to ? `bis ${o.valid_to}` : 'unbefristet'
          return (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {CONSTRAINT_LABELS[o.constraint_id] ?? o.constraint_id} &mdash; ab{' '}
                  {o.valid_from}, {toStr}
                </p>
                {o.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{o.reason}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteTarget(o.id)}
                aria-label="Löschen"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
      </div>

      <ConstraintOverrideFormDialog
        doctorId={doctorId}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Override wird dauerhaft entfernt.
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
