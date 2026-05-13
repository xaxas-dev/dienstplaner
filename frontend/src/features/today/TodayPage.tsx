import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CommandBar } from '@/components/dp/CommandBar'

export function TodayPage() {
  const now = new Date()
  const dateLabel = format(now, "EEEE, d. MMMM yyyy", { locale: de })

  return (
    <div className="flex flex-col flex-1">
      <CommandBar
        titleAccent="Heute"
        title={dateLabel}
        showSearch
      />
      <div className="px-10 py-6">
        <p className="text-sm text-ink-2">Diese Ansicht wird in M2-003 implementiert.</p>
        <div className="mt-4 border-2 border-dashed border-line rounded-2xl p-10 text-center text-ink-3 text-sm">
          Dashboard-Platzhalter
        </div>
      </div>
    </div>
  )
}
