import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
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
import { InactiveToggle } from '@/components/inactive-toggle'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { useDepartments, useDeleteDepartment } from './useDepartments'
import { DepartmentFormDialog } from './DepartmentFormDialog'
import type { Department } from '@/lib/types'

export function DepartmentListPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editDepartment, setEditDepartment] = useState<Department | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const { data: departments, isLoading, isError, refetch } = useDepartments(includeInactive)
  const deleteMutation = useDeleteDepartment()

  const handleEdit = (dept: Department) => {
    setEditDepartment(dept)
    setFormOpen(true)
  }

  const handleNewClick = () => {
    setEditDepartment(undefined)
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

  const sorted = [...(departments ?? [])].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, 'de'),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stationen</h1>
        <Button onClick={handleNewClick}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Neue Station
        </Button>
      </div>

      <div className="px-6 py-3 border-b border-border">
        <InactiveToggle
          id="dept-inactive"
          checked={includeInactive}
          onCheckedChange={setIncludeInactive}
        />
      </div>

      <div className="flex-1 px-6 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Laden…
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive">Daten konnten nicht geladen werden.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Erneut versuchen
            </Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <p>Noch keine Stationen angelegt.</p>
            <Button onClick={handleNewClick}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Neue Station
            </Button>
          </div>
        )}

        {!isLoading && !isError && sorted.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kurzname</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Dienst-relevant</TableHead>
                  <TableHead>Besetzung</TableHead>
                  <TableHead className="text-right">Reihenfolge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dept.short_name ?? '–'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.is_external ? 'outline' : 'secondary'}>
                        {dept.is_external ? 'Extern' : 'Intern'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.is_shift_relevant ? 'default' : 'secondary'}>
                        {dept.is_shift_relevant ? 'Ja' : 'Nein'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dept.min_headcount != null && dept.max_headcount != null
                        ? `${dept.min_headcount} – ${dept.max_headcount}`
                        : dept.min_headcount != null
                          ? `≥ ${dept.min_headcount}`
                          : dept.max_headcount != null
                            ? `≤ ${dept.max_headcount}`
                            : '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {dept.display_order}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.active ? 'default' : 'secondary'}>
                        {dept.active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Bearbeiten"
                          onClick={() => handleEdit(dept)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Löschen"
                          onClick={() => setDeleteTarget(dept)}
                        >
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

      <DepartmentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditDepartment(undefined)
        }}
        department={editDepartment}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Station löschen?"
        description={`„${deleteTarget?.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
