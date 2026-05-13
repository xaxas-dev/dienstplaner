import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
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
import { CommandBar } from '@/components/dp/CommandBar'
import { DoctorCard } from './DoctorCard'
import { useDoctors, useDeleteDoctor } from './useDoctors'
import type { Doctor } from '@/lib/types'

type FilterKey = 'all' | 'facharzt' | 'wba' | 'extern'

function applyFilter(doctors: Doctor[], filter: FilterKey): Doctor[] {
  switch (filter) {
    case 'facharzt': return doctors.filter((d) => d.is_facharzt)
    case 'wba':      return doctors.filter((d) => d.weiterbildungsjahr != null)
    case 'extern':   return doctors.filter((d) => d.doctor_type === 'EXTERNAL')
    default:         return doctors
  }
}

export function DoctorListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null)

  const { data: doctors, isLoading, isError, refetch } = useDoctors(includeInactive)
  const deleteMutation = useDeleteDoctor()

  const sorted = [...(doctors ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const visible = applyFilter(sorted, filter)
  const count = doctors?.length ?? 0

  const handleDelete = () => {
    if (!doctorToDelete) return
    deleteMutation.mutate(doctorToDelete.id, {
      onSuccess: () => {
        toast.success(`${doctorToDelete.name} wurde gelöscht`)
        setDoctorToDelete(null)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setDoctorToDelete(null)
      },
    })
  }

  const filterChips = [
    { label: 'Alle', active: filter === 'all',      onClick: () => setFilter('all') },
    { label: 'Fachärzte', active: filter === 'facharzt', onClick: () => setFilter('facharzt') },
    { label: 'WBA',       active: filter === 'wba',      onClick: () => setFilter('wba') },
    { label: 'Extern',    active: filter === 'extern',   onClick: () => setFilter('extern') },
    {
      label: includeInactive ? 'Inaktive ausblenden' : 'Inaktive anzeigen',
      active: includeInactive,
      onClick: () => setIncludeInactive((v) => !v),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        titleAccent="Team"
        title={count > 0 ? `· ${count} Ärzte` : ''}
        filters={filterChips}
        primaryAction={{
          label: '+ Neuer Arzt',
          onClick: () => void navigate('/doctors/new'),
        }}
        showSearch
      />

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        {isLoading && (
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-line p-5 h-44 animate-pulse" />
            ))}
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

        {!isLoading && !isError && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            {count === 0 ? (
              <>
                <p className="text-sm">Noch keine Ärzte angelegt.</p>
                <Button variant="accent" size="sm" onClick={() => void navigate('/doctors/new')}>
                  + Neuer Arzt
                </Button>
              </>
            ) : (
              <p className="text-sm">Keine Ärzte für diesen Filter.</p>
            )}
          </div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <div className="grid grid-cols-3 gap-3.5">
            {visible.map((doctor) => (
              <div key={doctor.id} className="relative group">
                <DoctorCard doctor={doctor} />
                <button
                  type="button"
                  aria-label="Arzt löschen"
                  onClick={() => setDoctorToDelete(doctor)}
                  className="absolute top-3 right-3 hidden group-hover:flex items-center justify-center size-7 rounded-full bg-paper border border-line text-ink-3 hover:text-destructive hover:border-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={doctorToDelete !== null}
        onOpenChange={(open) => !open && setDoctorToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arzt wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{doctorToDelete?.name}</strong> wird dauerhaft gelöscht. Alle
              Beschäftigungszeiträume und Qualifikations-Zuweisungen werden ebenfalls
              entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
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
