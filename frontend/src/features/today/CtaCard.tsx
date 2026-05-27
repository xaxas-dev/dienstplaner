import { Link } from 'react-router-dom'
import type { PlanWithRelations } from '@/lib/types'
import { planToSlug } from '@/features/plans/planSlug'

export function CtaCard({ plan }: { plan: PlanWithRelations | null }) {
  const href = plan ? `/plans/${planToSlug(plan)}` : '/plans/new'
  const label = plan ? `Zum Plan: ${plan.name}` : 'Plan anlegen'
  const sub = plan
    ? 'Plan öffnen und Schichten bearbeiten'
    : 'Für diesen Monat existiert noch kein Plan'

  return (
    <div className="rounded-2xl bg-dp-accent border border-[#B45B30] p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#FFF8EF]">{sub}</p>
      </div>
      <Link
        to={href}
        className="shrink-0 rounded-lg bg-[#FFF8EF] px-4 py-2 text-sm font-semibold text-dp-accent hover:bg-paper transition-colors"
      >
        {label}
      </Link>
    </div>
  )
}
