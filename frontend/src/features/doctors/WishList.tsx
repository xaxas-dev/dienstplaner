import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useWishesByDoctor, useDeleteWish } from './useWishes'
import { WishFormDialog } from './WishFormDialog'
import type { Wish, WishType } from '@/lib/types'

const WISH_TYPE_LABELS: Record<WishType, string> = {
  AVOID_DAY: 'Tag vermeiden',
  AVOID_SHIFT: 'Dienst vermeiden',
  REQUIRE_SHIFT: 'Dienst wünschen',
}
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function formatScope(wish: Wish): string {
  if (wish.wish_date) {
    // Parse ISO date (YYYY-MM-DD) and format as DD.MM.YYYY without timezone shift
    const [year, month, day] = wish.wish_date.split('-')
    return `${day}.${month}.${year}`
  }
  if (wish.day_of_week != null) return `Jeden ${WEEKDAY_SHORT[wish.day_of_week]}`
  return 'Allgemein'
}

export function WishList({ doctorId }: { doctorId: number }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editWish, setEditWish] = useState<Wish | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Wish | null>(null)

  const { data: wishes = [], isLoading } = useWishesByDoctor(doctorId)
  const deleteMutation = useDeleteWish(doctorId)

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success('Wunsch gelöscht'); setDeleteTarget(null) },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Wünsche</h3>
        <Button size="sm" variant="outline" onClick={() => { setEditWish(undefined); setFormOpen(true) }}>
          <PlusCircle className="h-4 w-4 mr-1.5" />Neuer Wunsch
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>}
      {!isLoading && wishes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Keine Wünsche hinterlegt.</p>
      )}

      <div className="space-y-2">
        {wishes.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {formatScope(w)} — {WISH_TYPE_LABELS[w.wish_type]}
                {w.priority > 1 && <span className="ml-2 text-xs text-muted-foreground">P{w.priority}</span>}
              </p>
              {w.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.notes}</p>}
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <Button size="sm" variant="ghost" onClick={() => { setEditWish(w); setFormOpen(true) }} aria-label="Bearbeiten">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(w)} aria-label="Löschen">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <WishFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditWish(undefined) }}
        doctorId={doctorId}
        wish={editWish}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wunsch löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dieser Wunsch wird dauerhaft entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
