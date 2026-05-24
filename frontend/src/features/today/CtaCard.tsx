import { Link } from 'react-router-dom'
import type { PlanWithRelations } from '@/lib/types'

export function CtaCard({ plan }: { plan: PlanWithRelations | null }) {
  const href = plan ? `/plans/${plan.id}` : '/plans/new'
  const label = plan ? `Zum Plan: ${plan.name}` : 'Plan anlegen'
  const sub = plan
    ? 'Plan öffnen und Schichten bearbeiten'
    : 'Für diesen Monat existiert noch kein Plan'

  return (
    <div className="rounded-2xl bg-ink text-paper border border-line p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-paper">{sub}</p>
      </div>
      <Link
        to={href}
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-paper hover:bg-[#B45B30] transition-colors"
      >
        {label}
      </Link>
    </div>
  )
}
