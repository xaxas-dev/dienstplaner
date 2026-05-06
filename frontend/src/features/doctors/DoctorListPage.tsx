import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { useDoctors, useDeleteDoctor } from './useDoctors'
import { formatEmploymentSummary } from './doctorHelpers'
import type { Doctor } from '@/lib/types'

function DoctorTypeBadge({ type }: { type: Doctor['doctor_type'] }) {
  return (
    <Badge variant={type === 'INTERNAL' ? 'secondary' : 'outline'}>
      {type === 'INTERNAL' ? 'Intern' : 'Extern'}
    </Badge>
  )
}

function QualificationDisplay({ doctor }: { doctor: Doctor }) {
  const label = doctor.is_facharzt
    ? 'Facharzt'
    : doctor.weiterbildungsjahr
      ? `WBJ ${doctor.weiterbildungsjahr}`
      : '–'
  return <span className="text-sm text-muted-foreground">{label}</span>
}

export function DoctorListPage() {
  const navigate = useNavigate()
  const [includeInactive, setIncludeInactive] = useState(false)
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null)

  const { data: doctors, isLoading, isError, refetch } = useDoctors(includeInactive)
  const deleteMutation = useDeleteDoctor()

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

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ärzte</h1>
        <Button onClick={() => void navigate('/doctors/new')}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Neuer Arzt
        </Button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <Switch
          id="include-inactive"
          checked={includeInactive}
          onCheckedChange={setIncludeInactive}
        />
        <Label htmlFor="include-inactive" className="cursor-pointer text-sm">
          Inaktive anzeigen
        </Label>
      </div>

      {/* Content */}
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

        {!isLoading && !isError && doctors?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <p>Noch keine Ärzte angelegt.</p>
            <Button asChild>
              <Link to="/doctors/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                Neuer Arzt
              </Link>
            </Button>
          </div>
        )}

        {!isLoading && !isError && doctors && doctors.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Qualifikation</TableHead>
                  <TableHead>Beschäftigung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...doctors]
                  .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                  .map((doctor) => (
                    <TableRow
                      key={doctor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => void navigate(`/doctors/${doctor.id}`)}
                    >
                      <TableCell className="font-medium">{doctor.name}</TableCell>
                      <TableCell>
                        <DoctorTypeBadge type={doctor.doctor_type} />
                      </TableCell>
                      <TableCell>
                        <QualificationDisplay doctor={doctor} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatEmploymentSummary(doctor.employment_periods)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doctor.active ? 'default' : 'secondary'}>
                          {doctor.active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            aria-label="Bearbeiten"
                          >
                            <Link to={`/doctors/${doctor.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Löschen"
                            onClick={() => setDoctorToDelete(doctor)}
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

      {/* Bestätigungs-Dialog */}
      <AlertDialog open={doctorToDelete !== null} onOpenChange={(open) => !open && setDoctorToDelete(null)}>
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
