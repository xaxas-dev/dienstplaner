import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { useDoctor, useDeleteDoctor } from './useDoctors'
import { DoctorForm } from './DoctorForm'
import { EmploymentPeriodList } from './EmploymentPeriodList'
import { QualificationManager } from './QualificationManager'
import { INAExclusionList } from './INAExclusionList'
import { AbsenceList } from './AbsenceList'

type Tab = 'stammdaten' | 'beschaeftigung' | 'qualifikationen' | 'ina-ausschluesse' | 'abwesenheiten'

export function DoctorDetailPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('stammdaten')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const id = Number(doctorId)
  const { data: doctor, isLoading, isError } = useDoctor(id)
  const deleteMutation = useDeleteDoctor()

  const handleDelete = () => {
    if (!doctor) return
    deleteMutation.mutate(doctor.id, {
      onSuccess: () => {
        toast.success(`${doctor.name} wurde gelöscht`)
        void navigate('/doctors')
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setConfirmDelete(false)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 py-16 text-muted-foreground">
        Laden…
      </div>
    )
  }

  if (isError || !doctor) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 gap-4">
        <p className="text-destructive">Arzt nicht gefunden.</p>
        <Button variant="outline" onClick={() => void navigate('/doctors')}>
          Zurück zur Liste
        </Button>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stammdaten', label: 'Stammdaten' },
    { key: 'beschaeftigung', label: 'Beschäftigung' },
    { key: 'qualifikationen', label: 'Qualifikationen' },
    { key: 'ina-ausschluesse', label: 'INA-Ausschlüsse' },
    { key: 'abwesenheiten', label: 'Abwesenheiten' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/doctors')}
            className="-ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Ärzte
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{doctor.name}</h1>
            <Badge variant={doctor.active ? 'default' : 'secondary'}>
              {doctor.active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Löschen
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'stammdaten' && (
          <div className="max-w-lg">
            {doctor.weiterbildungsjahr != null && (
              <div className="mb-5 rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {doctor.weiterbildungsjahr}. Weiterbildungsjahr
                </span>{' '}
                (berechnet aus Eintrittsdatum)
              </div>
            )}
            <DoctorForm doctor={doctor} />
          </div>
        )}

        {activeTab === 'beschaeftigung' && (
          <div className="max-w-2xl">
            <EmploymentPeriodList
              doctorId={doctor.id}
              periods={doctor.employment_periods}
            />
          </div>
        )}

        {activeTab === 'qualifikationen' && (
          <div className="max-w-2xl">
            <QualificationManager
              doctorId={doctor.id}
              assigned={doctor.qualifications}
            />
          </div>
        )}

        {activeTab === 'ina-ausschluesse' && (
          <div className="max-w-2xl">
            <INAExclusionList doctorId={doctor.id} />
          </div>
        )}

        {activeTab === 'abwesenheiten' && (
          <div className="max-w-2xl">
            <AbsenceList doctorId={doctor.id} />
          </div>
        )}
      </div>

      <Separator />

      {/* Delete Dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arzt wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{doctor.name}</strong> wird dauerhaft gelöscht. Alle
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
