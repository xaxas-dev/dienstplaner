import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandBar } from '@/components/dp/CommandBar'
import { useHolidays, useDeleteHoliday, useSeedHolidays } from './useHolidays'
import { HolidayFormDialog } from './HolidayFormDialog'
import type { Holiday } from '@/lib/types'

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  const weekday = WEEKDAYS[d.getDay()]
  return `${weekday}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

function HolidayRow({ holiday, onDelete }: { holiday: Holiday; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink font-medium w-52">{formatDate(holiday.date)}</span>
        <span className="text-sm text-ink">{holiday.name}</span>
        {holiday.source === 'AUTO' && (
          <span className="text-[10px] font-medium text-ink-3 bg-paper px-1.5 py-0.5 rounded border border-line">
            SH
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-ink-3 hover:text-destructive"
        onClick={onDelete}
        aria-label={`${holiday.name} löschen`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function HolidayListPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: holidays, isLoading, isError } = useHolidays(year)
  const deleteMutation = useDeleteHoliday(year)
  const seedMutation = useSeedHolidays()

  function handleDelete(holidayDate: string, name: string) {
    deleteMutation.mutate(holidayDate, {
      onSuccess: () => toast.success(`${name} gelöscht`),
      onError: () => toast.error('Löschen fehlgeschlagen'),
    })
  }

  function handleSeed() {
    seedMutation.mutate(year, {
      onSuccess: (data) => {
        if (data.added === 0) {
          toast.info('SH-Feiertage bereits vorhanden')
        } else {
          toast.success(`${data.added} SH-Feiertage für ${year} hinzugefügt`)
        }
      },
      onError: () => toast.error('Seed fehlgeschlagen'),
    })
  }

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        title="Feiertage"
        primaryAction={{
          label: 'Manuell hinzufügen',
          icon: Plus,
          onClick: () => setDialogOpen(true),
        }}
      />
      <div className="flex-1 px-10 py-6 overflow-y-auto">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
              ← {year - 1}
            </Button>
            <span className="text-base font-semibold text-ink w-16 text-center">{year}</span>
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
              {year + 1} →
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 gap-1.5"
              onClick={handleSeed}
              disabled={seedMutation.isPending}
            >
              <RefreshCw className="size-3.5" />
              SH-Feiertage laden
            </Button>
          </div>

          <div className="rounded-2xl bg-card border border-line p-5">
            {isLoading && <p className="text-sm text-ink-3">Lade Feiertage…</p>}
            {isError && <p className="text-sm text-destructive">Fehler beim Laden.</p>}
            {holidays && holidays.length === 0 && (
              <p className="text-sm text-ink-3 py-2">
                Keine Feiertage für {year}. „SH-Feiertage laden" oder manuell hinzufügen.
              </p>
            )}
            {holidays && holidays.length > 0 && holidays.map((h) => (
              <HolidayRow
                key={h.date}
                holiday={h}
                onDelete={() => handleDelete(h.date, h.name)}
              />
            ))}
          </div>
        </div>
      </div>

      <HolidayFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
