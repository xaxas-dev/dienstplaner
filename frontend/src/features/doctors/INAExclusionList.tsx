import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
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
import { useINAExclusions, useDeleteINAExclusion } from './useINAExclusions'
import { INAExclusionFormDialog } from './INAExclusionFormDialog'
import { formatDate } from './doctorHelpers'
import type { INAExclusion } from '@/lib/types'

const REASON_LABELS: Record<string, string> = {
  SCHWANGERSCHAFT: 'Schwangerschaft',
  EINARBEITUNG: 'Einarbeitung',
  SONSTIGES: 'Sonstiges',
}

interface INAExclusionListProps {
  doctorId: number
}

export function INAExclusionList({ doctorId }: INAExclusionListProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editExclusion, setEditExclusion] = useState<INAExclusion | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<INAExclusion | null>(null)

  const { data: exclusions = [], isLoading } = useINAExclusions(doctorId)
  const deleteMutation = useDeleteINAExclusion(doctorId)

  const sorted = [...exclusions].sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  const handleEdit = (excl: INAExclusion) => {
    setEditExclusion(excl)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditExclusion(undefined)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('INA-Ausschluss gelöscht')
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
          INA-Ausschlüsse
        </h3>
        <Button size="sm" variant="outline" onClick={handleNew}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Neuer Ausschluss
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Keine INA-Ausschlüsse hinterlegt.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((excl) => {
          const toStr = excl.valid_to ? `bis ${formatDate(excl.valid_to)}` : 'unbefristet'
          return (
            <div
              key={excl.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {REASON_LABELS[excl.reason] ?? excl.reason} &mdash; ab {formatDate(excl.valid_from)}, {toStr}
                </p>
                {excl.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{excl.notes}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-4">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(excl)} aria-label="Bearbeiten">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(excl)} aria-label="Löschen">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <INAExclusionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditExclusion(undefined)
        }}
        doctorId={doctorId}
        exclusion={editExclusion}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>INA-Ausschluss löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
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
