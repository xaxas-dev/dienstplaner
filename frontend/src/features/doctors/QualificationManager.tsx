import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQualifications, useAddQualification, useRemoveQualification } from './useDoctors'
import type { Qualification } from '@/lib/types'

interface QualificationManagerProps {
  doctorId: number
  assigned: Qualification[]
}

export function QualificationManager({ doctorId, assigned }: QualificationManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  const { data: allQualifications } = useQualifications()
  const addMutation = useAddQualification(doctorId)
  const removeMutation = useRemoveQualification(doctorId)

  const assignedIds = new Set(assigned.map((q) => q.id))
  const available = (allQualifications ?? []).filter(
    (q) => q.active && !assignedIds.has(q.id),
  )

  const handleAdd = () => {
    if (!selectedId) return
    const qualId = Number(selectedId)
    addMutation.mutate(
      { qualificationId: qualId },
      {
        onSuccess: () => {
          const qual = allQualifications?.find((q) => q.id === qualId)
          toast.success(`Qualifikation "${qual?.name ?? ''}" hinzugefügt`)
          setDialogOpen(false)
          setSelectedId('')
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen')
        },
      },
    )
  }

  const handleRemove = (qual: Qualification) => {
    removeMutation.mutate(qual.id, {
      onSuccess: () => toast.success(`Qualifikation "${qual.name}" entfernt`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen'),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Qualifikationen
        </h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Hinzufügen
        </Button>
      </div>

      {assigned.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Keine Qualifikationen zugewiesen.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {assigned.map((qual) => (
          <Badge key={qual.id} variant="secondary" className="gap-1.5 pl-3 pr-1.5 py-1">
            <span>{qual.name}</span>
            <button
              type="button"
              onClick={() => handleRemove(qual)}
              aria-label={`${qual.name} entfernen`}
              className="hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedId('')
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Qualifikation hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Alle verfügbaren Qualifikationen sind bereits zugewiesen.
              </p>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualifikation wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((q) => (
                    <SelectItem key={q.id} value={String(q.id)}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedId || addMutation.isPending || available.length === 0}
            >
              {addMutation.isPending ? 'Hinzufügen…' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
