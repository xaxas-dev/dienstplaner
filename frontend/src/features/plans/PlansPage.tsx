import { useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { CommandBar } from '@/components/dp/CommandBar'

const VIEW_FILTERS = ['2 Wochen', '4 Wochen', '1 Tag'] as const

export function PlansPage() {
  const [activeFilter, setActiveFilter] = useState<string>('2 Wochen')
  const now = new Date()
  const monthName = format(now, 'MMMM', { locale: de })
  const year = format(now, 'yyyy')

  const filters = VIEW_FILTERS.map((label) => ({
    label,
    active: label === activeFilter,
    onClick: () => setActiveFilter(label),
  }))

  return (
    <div className="flex flex-col flex-1">
      <CommandBar
        titleAccent={monthName}
        title={year}
        filters={filters}
        primaryAction={{
          label: '+ Neuer Plan',
          onClick: () => toast.info('Plan-Erstellung kommt in M2-003'),
        }}
        showSearch
      />
      <div className="px-10 py-6">
        <p className="text-sm text-ink-2">Diese Ansicht wird in M2-003 implementiert.</p>
        <div className="mt-4 border-2 border-dashed border-line rounded-2xl p-10 text-center text-ink-3 text-sm">
          Plan-Grid-Platzhalter
        </div>
      </div>
    </div>
  )
}
