import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { MoreHorizontal, Trash2 } from 'lucide-react'
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

function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const [showDelete, setShowDelete] = useState(false)
  const deletePlan = useDeletePlan()
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
  return (
    <>
      <div className="group relative rounded-2xl bg-card border border-line hover:border-accent transition">
        <button
          onClick={onClick}
          className="w-full p-5 text-left"
        >
          <p className="font-serif text-xl capitalize">{title}</p>
          <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">{plan.status}</p>
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
              onClick={() => deletePlan.mutate(plan.id)}
              disabled={deletePlan.isPending}
            >
              <Trash2 className="size-4 mr-1" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PlanListPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()
  const { data: plans = [], isLoading, isError, refetch } = usePlans()

  return (
    <div className="flex flex-col flex-1">
      <CommandBar
        title="Pläne"
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
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {plans.map((plan) => (
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
