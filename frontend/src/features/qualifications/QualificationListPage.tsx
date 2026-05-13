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
import { ApiError } from '@/lib/api'
import { CommandBar } from '@/components/dp/CommandBar'
import { useQualifications, useDeleteQualification } from './useQualifications'
import { QualificationFormDialog } from './QualificationFormDialog'
import type { Qualification } from '@/lib/types'

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '–'
  return text.length > max ? text.slice(0, max) + '…' : text
}

export function QualificationListPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editQual, setEditQual] = useState<Qualification | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Qualification | null>(null)

  const { data: qualifications, isLoading, isError, refetch } = useQualifications(includeInactive)
  const deleteMutation = useDeleteQualification()

  const handleEdit = (qual: Qualification) => { setEditQual(qual); setFormOpen(true) }
  const handleNewClick = () => { setEditQual(undefined); setFormOpen(true) }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success(`„${deleteTarget.name}" wurde gelöscht`); setDeleteTarget(null) },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : 'Löschen fehlgeschlagen'
        toast.error(msg)
        setDeleteTarget(null)
      },
    })
  }

  const sorted = [...(qualifications ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const filterChips = [{
    label: includeInactive ? 'Inaktive ausblenden' : 'Inaktive anzeigen',
    active: includeInactive,
    onClick: () => setIncludeInactive((v) => !v),
  }]

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        title="Qualifikationen"
        filters={filterChips}
        showSearch={false}
        primaryAction={{ label: '+ Neue Qualifikation', onClick: handleNewClick }}
      />

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-16 text-ink-3">Laden…</div>}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive">Daten konnten nicht geladen werden.</p>
            <Button variant="outline" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            <p className="text-sm">Noch keine Qualifikationen angelegt.</p>
            <Button variant="accent" size="sm" onClick={handleNewClick}>+ Neue Qualifikation</Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length > 0 && (
          <div className="rounded-2xl border border-line bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kurzname</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((qual) => (
                  <TableRow key={qual.id}>
                    <TableCell className="font-medium text-ink">{qual.name}</TableCell>
                    <TableCell className="text-ink-2">{qual.short_name ?? '–'}</TableCell>
                    <TableCell className="text-sm text-ink-2 max-w-xs">{truncate(qual.description, 100)}</TableCell>
                    <TableCell>
                      <Badge variant={qual.active ? 'ok' : 'muted'}>
                        {qual.active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label="Bearbeiten" onClick={() => handleEdit(qual)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Löschen" onClick={() => setDeleteTarget(qual)}>
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

      <QualificationFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditQual(undefined) }}
        qualification={editQual}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Qualifikation löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden. Falls die Qualifikation noch Ärzten zugewiesen ist, wird das Löschen abgelehnt."
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
