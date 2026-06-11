import type { ShiftWithDetails } from '@/lib/types'

export function computeDragDimDays(shifts: ShiftWithDetails[], shiftTypeId: number): Set<string> {
  const days = new Set<string>()
  for (const shift of shifts) {
    if (shift.shift_type_id === shiftTypeId && shift.doctor_id != null) {
      days.add(shift.shift_date)
    }
  }
  return days
}
