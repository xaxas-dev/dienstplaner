import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CommandBar } from '@/components/dp/CommandBar'
import { usePlans } from './usePlans'
import { useDeletePlan } from './useDeletePlan'
import { planToSlug } from './planSlug'
import { PlanCreateDialog } from './components/PlanCreateDialog'
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
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })

  const handleDelete = () => {
    deletePlan.mutate(plan.id, {
      onSuccess: () => {
        toast.success('Plan gelöscht')
        setShowDelete(false)
      },
      onError: () => {
        toast.error('Löschen fehlgeschlagen')
      },
    })
  }

  return (
    <>
      <div className="group relative rounded-2xl bg-card border border-line hover:border-accent transition">
        <button
          onClick={onClick}
          className="w-full p-5 text-left"
        >
          <p className="font-serif text-xl capitalize">{title}</p>
          <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">
            {plan.status === 'RELEASED' ? 'Freigegeben' : plan.status === 'ARCHIVED' ? 'Archiviert' : 'Entwurf'}
          </p>
        </button>
        <button
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-line"
          onClick={(e) => { e.stopPropagation(); setShowDelete(true) }}
          aria-label="Plan-Aktionen"
        >
          <MoreHorizontal className="size-4 text-ink-3" />
        </button>
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
  const [filter, setFilter] = useState<PlanFilterKey>('all')
  const navigate = useNavigate()
  const { data: plans = [], isLoading, isError, refetch } = usePlans()

  const visible = applyPlanFilter(plans, filter)
  const count = visible.length
  const totalCount = plans.length

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
          <div className="grid grid-cols-3 gap-3.5">
            {visible.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => navigate(`/plans/${planToSlug(plan)}`)}
              />
            ))}
          </div>
        )}
      </div>
      <PlanCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
