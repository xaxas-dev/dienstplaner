import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { CommandBar } from '@/components/dp/CommandBar'
import { ShiftChip } from '@/components/dp/ShiftChip'
import { useShiftTypes, useDeleteShiftType } from './useShiftTypes'
import { ShiftTypeFormDialog } from './ShiftTypeFormDialog'
import type { ShiftType } from '@/lib/types'

function formatTime(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '–'
  if (start && end) return `${start} – ${end}`
  return start ?? end ?? '–'
}

export function ShiftTypeListPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editShiftType, setEditShiftType] = useState<ShiftType | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ShiftType | null>(null)

  const { data: shiftTypes, isLoading, isError, refetch } = useShiftTypes(includeInactive)
  const deleteMutation = useDeleteShiftType()

  const handleEdit = (st: ShiftType) => {
    setEditShiftType(st)
    setFormOpen(true)
  }

  const handleNewClick = () => {
    setEditShiftType(undefined)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`„${deleteTarget.name}" wurde gelöscht`)
        setDeleteTarget(null)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setDeleteTarget(null)
      },
    })
  }

  const sorted = [...(shiftTypes ?? [])].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, 'de'),
  )

  const filterChips = [
    {
      label: includeInactive ? 'Inaktive ausblenden' : 'Inaktive anzeigen',
      active: includeInactive,
      onClick: () => setIncludeInactive((v) => !v),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        title="Schichttypen"
        filters={filterChips}
        showSearch={false}
        primaryAction={{ label: '+ Neuer Schichttyp', onClick: handleNewClick }}
      />

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-ink-3">Laden…</div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive">Daten konnten nicht geladen werden.</p>
            <Button variant="outline" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            <p className="text-sm">Noch keine Schichttypen angelegt.</p>
            <Button variant="accent" size="sm" onClick={handleNewClick}>+ Neuer Schichttyp</Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length > 0 && (
          <div className="rounded-2xl border border-line bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Werktag</TableHead>
                  <TableHead>Wochenende</TableHead>
                  <TableHead>Uhrzeit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShiftChip code={st.short_name} shiftTypeId={st.id} size="sm" />
                        <span className="font-medium text-ink">{st.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.applies_on_weekdays ? 'ok' : 'muted'}>
                        {st.applies_on_weekdays ? 'Ja' : 'Nein'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.applies_on_weekend ? 'ok' : 'muted'}>
                        {st.applies_on_weekend ? 'Ja' : 'Nein'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-ink-2">
                      {formatTime(st.start_time, st.end_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.active ? 'ok' : 'muted'}>
                        {st.active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label="Bearbeiten" onClick={() => handleEdit(st)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Löschen" onClick={() => setDeleteTarget(st)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ShiftTypeFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditShiftType(undefined) }}
        shiftType={editShiftType}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Schichttyp löschen?"
        description={`„${deleteTarget?.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
