import { eachDayOfInterval } from 'date-fns'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

export interface GridCell {
  shifts: ShiftWithDetails[]
  hasConflict: boolean
}

export interface GridRow {
  doctor: Doctor
  cells: Record<string, GridCell>
}

export interface GridData {
  rows: GridRow[]
  days: Date[]
  openShiftsByDay: Record<string, ShiftWithDetails[]>
}

export function buildGridData(
  shifts: ShiftWithDetails[],
  doctors: Doctor[],
  validFrom: string,
  validTo: string,
): GridData {
  const days = eachDayOfInterval({
    start: new Date(validFrom),
    end: new Date(validTo),
  })

  const openShiftsByDay: Record<string, ShiftWithDetails[]> = {}
  const assignedShifts = shifts.filter((s) => {
    if (s.doctor_id === null || s.doctor_id === undefined) {
      openShiftsByDay[s.shift_date] = [
        ...(openShiftsByDay[s.shift_date] ?? []),
        s,
      ]
      return false
    }
    return true
  })

  const rows: GridRow[] = doctors.map((doctor) => {
    const cells: Record<string, GridCell> = {}
    for (const shift of assignedShifts) {
      if (shift.doctor_id !== doctor.id) continue
      const key = shift.shift_date
      if (cells[key]) {
        cells[key].shifts.push(shift)
        if (shift.conflicts.length > 0) cells[key].hasConflict = true
      } else {
        cells[key] = { shifts: [shift], hasConflict: shift.conflicts.length > 0 }
      }
    }
    return { doctor, cells }
  })

  return { rows, days, openShiftsByDay }
}
