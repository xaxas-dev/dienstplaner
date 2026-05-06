import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EmploymentPeriod } from '@/lib/types'

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd.M.yyyy', { locale: de })
}

export function getCurrentEmploymentPeriod(periods: EmploymentPeriod[]): EmploymentPeriod | null {
  const today = startOfDay(new Date())
  return (
    periods.find((ep) => {
      const from = parseISO(ep.valid_from)
      if (ep.valid_to === null || ep.valid_to === undefined) {
        return from <= today
      }
      return isWithinInterval(today, { start: from, end: parseISO(ep.valid_to) })
    }) ?? null
  )
}

export function formatEmploymentSummary(periods: EmploymentPeriod[]): string {
  if (periods.length === 0) return 'Keine Beschäftigung hinterlegt'

  const current = getCurrentEmploymentPeriod(periods)
  if (!current) {
    const next = [...periods]
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
      .find((ep) => parseISO(ep.valid_from) > new Date())
    if (next) {
      return `Ab ${formatDate(next.valid_from)}: ${next.employment_percentage}%`
    }
    return `${periods[0].employment_percentage}% (abgelaufen)`
  }

  const toStr = current.valid_to ? `bis ${formatDate(current.valid_to)}` : 'unbefristet'
  const base = `${current.employment_percentage}% (${toStr})`

  const future = periods.filter(
    (ep) => ep.id !== current.id && parseISO(ep.valid_from) > new Date(),
  )
  if (future.length > 0) {
    const next = future.sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0]
    return `${base}, wechselt zu ${next.employment_percentage}% am ${formatDate(next.valid_from)}`
  }
  return base
}
