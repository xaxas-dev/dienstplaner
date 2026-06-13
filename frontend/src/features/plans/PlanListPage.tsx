import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { MoreHorizontal, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CommandBar } from '@/components/dp/CommandBar'
import { usePlans } from './usePlans'
import { useDeletePlan } from './useDeletePlan'
import { useUpdatePlan } from './useUpdatePlan'
import { planToSlug } from './planSlug'
import { PlanCreateDialog } from './components/PlanCreateDialog'
import { Button } from '@/components/ui/button'
import { ImportDialog } from './components/ImportDialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Plan } from '@/lib/types'

type PlanFilterKey = 'all' | 'draft' | 'released' | 'archived'

function applyPlanFilter(plans: Plan[], filter: PlanFilterKey): Plan[] {
  switch (filter) {
    case 'draft':    return plans.filter((p) => p.status === 'DRAFT')
    case 'released': return plans.filter((p) => p.status === 'RELEASED')
    case 'archived': return plans.filter((p) => p.status === 'ARCHIVED')
    default:         return plans
  }
}

function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const [showDelete, setShowDelete] = useState(false)
  const deletePlan = useDeletePlan()
  const updatePlan = useUpdatePlan(plan.id)
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })

  const handleDelete = () => {
    deletePlan.mutate(plan.id, {
      onSuccess: () => { toast.success('Plan gelöscht'); setShowDelete(false) },
      onError: () => { toast.error('Löschen fehlgeschlagen') },
    })
  }

  const handleStatusChange = (newStatus: 'DRAFT' | 'RELEASED' | 'ARCHIVED') => {
    updatePlan.mutate({ status: newStatus }, {
      onSuccess: () => toast.success('Status geändert'),
      onError: () => toast.error('Statusänderung fehlgeschlagen'),
    })
  }

  const statusLabel =
    plan.status === 'RELEASED' ? 'Freigegeben'
    : plan.status === 'ARCHIVED' ? 'Archiviert'
    : 'Entwurf'

  return (
    <>
      <div className="group relative rounded-2xl bg-card border border-line hover:border-accent transition">
        <button onClick={onClick} className="w-full p-5 text-left">
          <p className="font-serif text-xl capitalize">{title}</p>
          <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">{statusLabel}</p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-line"
              aria-label="Plan-Aktionen"
            >
              <MoreHorizontal className="size-4 text-ink-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {plan.status !== 'RELEASED' && (
              <DropdownMenuItem onClick={() => handleStatusChange('RELEASED')}>
                Freigeben
              </DropdownMenuItem>
            )}
            {plan.status !== 'ARCHIVED' && (
              <DropdownMenuItem onClick={() => handleStatusChange('ARCHIVED')}>
                Archivieren
              </DropdownMenuItem>
            )}
            {plan.status !== 'DRAFT' && (
              <DropdownMenuItem onClick={() => handleStatusChange('DRAFT')}>
                Zurück zu Entwurf
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{title}" wird unwiderruflich gelöscht — inklusive aller Schichten und Rotationen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deletePlan.isPending}
            >
              <Trash2 className="size-4 mr-1" />
              {deletePlan.isPending ? 'Wird gelöscht…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PlanListPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState<PlanFilterKey>('all')
  const navigate = useNavigate()
  const { data: plans = [], isLoading, isError, refetch } = usePlans()

  const visible = applyPlanFilter(plans, filter)
  const count = visible.length
  const totalCount = plans.length

  const plansByYear = useMemo(() => {
    const map = new Map<number, Plan[]>()
    for (const p of visible) {
      const year = new Date(p.valid_from).getFullYear()
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(p)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [visible])

  const filterChips = [
    { label: 'Alle',         active: filter === 'all',      onClick: () => setFilter('all') },
    { label: 'Entwurf',      active: filter === 'draft',    onClick: () => setFilter('draft') },
    { label: 'Freigegeben',  active: filter === 'released', onClick: () => setFilter('released') },
    { label: 'Archiviert',   active: filter === 'archived', onClick: () => setFilter('archived') },
  ]

  return (
    <div className="flex flex-col flex-1">
      <CommandBar
        titleAccent="Pläne"
        title={count > 0 ? `· ${count} ${count === 1 ? 'Plan' : 'Pläne'}` : ''}
        filters={filterChips}
        extras={
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importieren
          </Button>
        }
        primaryAction={{ label: '+ Neuer Plan', onClick: () => setDialogOpen(true) }}
      />
      <div className="px-10 py-6 flex-1">
        {isError && (
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm text-warn-ink">Fehler beim Laden der Pläne.</p>
            <button
              onClick={() => void refetch()}
              className="text-sm underline text-accent"
            >
              Erneut versuchen
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-card border border-line h-28 animate-pulse"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            {totalCount === 0 ? (
              <>
                <p className="text-sm">Noch keine Pläne angelegt.</p>
              </>
            ) : (
              <p className="text-sm">Keine Pläne für diesen Filter.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {plansByYear.map(([year, yearPlans]) => (
              <div key={year}>
                <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">{year}</h2>
                <div className="grid grid-cols-3 gap-3.5">
                  {yearPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onClick={() => navigate(`/plans/${planToSlug(plan)}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PlanCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
