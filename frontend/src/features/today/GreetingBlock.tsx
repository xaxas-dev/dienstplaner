import { format, getISOWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import { useClinicName } from '@/lib/useSettings'

export function GreetingBlock({ date }: { date: Date }) {
  const { data: clinicNameSetting } = useClinicName()
  const clinicName = clinicNameSetting?.value ?? null

  const weekday = format(date, 'EEEE', { locale: de })
  const dateStr = format(date, 'd. MMMM yyyy', { locale: de })
  const kw = getISOWeek(date)
  const kicker = `${weekday} · ${dateStr} · KW ${kw}`

  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-ink-3 font-medium">{kicker}</p>
      <h1 className="mt-1 font-serif text-[38px] leading-tight font-normal text-ink">
        {clinicName ? (
          <>
            {clinicName} —{' '}
            <em className="not-italic text-accent">Heute</em>{' '}
            im Blick
          </>
        ) : (
          <>
            Guten Morgen —{' '}
            <em className="not-italic text-accent">Heute</em>{' '}
            im Blick
          </>
        )}
      </h1>
    </div>
  )
}
