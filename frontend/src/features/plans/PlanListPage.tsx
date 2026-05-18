import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CommandBar } from '@/components/dp/CommandBar'
import { usePlans } from './usePlans'
import { PlanCreateDialog } from './components/PlanCreateDialog'
import type { Plan } from '@/lib/types'

function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-line p-5 text-left hover:border-accent transition"
    >
      <p className="font-serif text-xl capitalize">{title}</p>
      <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">{plan.status}</p>
    </button>
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
                onClick={() => navigate(`/plans/${plan.id}`)}
              />
            ))}
          </div>
        )}
      </div>
      <PlanCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
