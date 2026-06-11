import { describe, it, expect } from 'vitest'
import { computeDragDimDays } from './dragUtils'
import type { ShiftWithDetails } from '@/lib/types'

function makeShift(shiftTypeId: number, shiftDate: string, doctorId: number | null): ShiftWithDetails {
  return {
    id: Math.random(),
    plan_id: 1,
    shift_type_id: shiftTypeId,
    shift_date: shiftDate,
    doctor_id: doctorId,
    is_pinned: false,
    is_locked: false,
    note: null,
    shift_type: null,
    conflicts: [],
  } as unknown as ShiftWithDetails
}

describe('computeDragDimDays', () => {
  it('returns days where the shift type has an assigned doctor', () => {
    const shifts = [
      makeShift(1, '2026-06-01', 5),
      makeShift(1, '2026-06-02', null),
      makeShift(2, '2026-06-01', 7),
    ]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set(['2026-06-01']))
  })

  it('returns empty set when no assignments for shift type', () => {
    const shifts = [makeShift(1, '2026-06-01', null)]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set())
  })

  it('collects multiple assigned days', () => {
    const shifts = [
      makeShift(1, '2026-06-01', 5),
      makeShift(1, '2026-06-03', 9),
    ]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set(['2026-06-01', '2026-06-03']))
  })
})
