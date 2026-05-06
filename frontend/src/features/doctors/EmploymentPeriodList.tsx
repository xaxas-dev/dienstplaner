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
import { useDeleteEmploymentPeriod } from './useDoctors'
import { EmploymentPeriodForm } from './EmploymentPeriodForm'
import { formatDate } from './doctorHelpers'
import type { EmploymentPeriod } from '@/lib/types'

interface EmploymentPeriodListProps {
  doctorId: number
  periods: EmploymentPeriod[]
}

export function EmploymentPeriodList({ doctorId, periods }: EmploymentPeriodListProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editPeriod, setEditPeriod] = useState<EmploymentPeriod | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<EmploymentPeriod | null>(null)
  const deleteMutation = useDeleteEmploymentPeriod(doctorId)

  const sorted = [...periods].sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  const handleEdit = (period: EmploymentPeriod) => {
    setEditPeriod(period)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditPeriod(undefined)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Beschäftigungszeitraum gelöscht')
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
          Beschäftigungszeiträume
        </h3>
        <Button size="sm" variant="outline" onClick={handleNew}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Hinzufügen
        </Button>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Noch keine Beschäftigungszeiträume hinterlegt.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((ep) => {
          const toStr = ep.valid_to ? `bis ${formatDate(ep.valid_to)}` : 'unbefristet'
          return (
            <div
              key={ep.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {ep.employment_percentage}% &mdash; ab {formatDate(ep.valid_from)}, {toStr}
                </p>
                {ep.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ep.notes}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(ep)}
                  aria-label="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(ep)}
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <EmploymentPeriodForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditPeriod(undefined)
        }}
        doctorId={doctorId}
        period={editPeriod}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beschäftigungszeitraum löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig
              gemacht werden.
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
