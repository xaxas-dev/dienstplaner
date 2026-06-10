import type { Wish, ShiftType } from '@/lib/types'

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

/** Returns the distinct wish types matching this cell (for type badge in grid). */
export function getMatchingWishTypes(
  wishes: Wish[],
  doctorId: number,
  dayKey: string,
): Wish['wish_type'][] {
  const matching = wishes.filter((w) => wishMatchesCell(w, doctorId, dayKey))
  const types = new Set(matching.map((w) => w.wish_type))
  return [...types]
}

/**
 * Returns a short badge label for the grid cell, e.g. "N-", "T+", "kD".
 * AVOID dominates REQUIRE when both match the same cell.
 */
export function getWishBadge(
  wishes: Wish[],
  doctorId: number,
  dayKey: string,
  shiftTypes: ShiftType[],
): string | null {
  const matching = wishes.filter((w) => wishMatchesCell(w, doctorId, dayKey))
  if (matching.length === 0) return null

  const avoid = matching.find((w) => w.wish_type === 'AVOID_DAY' || w.wish_type === 'AVOID_SHIFT')
  const require = matching.find((w) => w.wish_type === 'REQUIRE_SHIFT')
  const primary = avoid ?? require
  if (!primary) return null

  if (primary.wish_type === 'AVOID_DAY') return 'kD'

  const st = primary.shift_type_id
    ? shiftTypes.find((s) => s.id === primary.shift_type_id)
    : null
  const short = st?.short_name ?? 'D'
  return primary.wish_type === 'AVOID_SHIFT' ? `${short}-` : `${short}+`
}
