import type { Wish } from '@/lib/types'

/** JS getDay() 0=So…6=Sa → Python weekday() 0=Mo…6=So: (getDay()+6)%7 */
function toPythonWeekday(jsDay: number): number {
  return (jsDay + 6) % 7
}

export function wishMatchesCell(wish: Wish, doctorId: number, dayKey: string): boolean {
  if (wish.doctor_id !== doctorId) return false

  if (wish.wish_date !== null) {
    return wish.wish_date === dayKey
  }

  if (wish.day_of_week !== null) {
    const date = new Date(dayKey + 'T00:00:00')
    return wish.day_of_week === toPythonWeekday(date.getDay())
  }

  return true // general wish matches any date
}

export function getWishHint(
  wishes: Wish[],
  doctorId: number,
  dayKey: string,
): 'avoid' | 'require' | null {
  const matching = wishes.filter((w) => wishMatchesCell(w, doctorId, dayKey))

  if (matching.some((w) => w.wish_type === 'AVOID_DAY' || w.wish_type === 'AVOID_SHIFT')) {
    return 'avoid'
  }

  if (matching.some((w) => w.wish_type === 'REQUIRE_SHIFT')) {
    return 'require'
  }

  return null
}
