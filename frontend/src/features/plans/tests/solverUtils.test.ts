import { describe, it, expect } from 'vitest'
import { buildSolverDiff } from '../solverUtils'
import type { ShiftWithDetails, Doctor, ProposedAssignment } from '@/lib/types'

const BASE_SHIFT_TYPE = {
  id: 10,
  name: 'Tagdienst',
  short_name: 'T',
  display_order: 1,
  active: true as const,
  notes: null,
  is_bereitschaftsdienst: false as const,
  applies_on_weekdays: true as const,
  applies_on_weekend: false as const,
  start_time: null,
  end_time: null,
  created_at: '',
  updated_at: '',
}

function makeShift(id: number, overrides: Partial<ShiftWithDetails> = {}): ShiftWithDetails {
  return {
    id,
    plan_id: 1,
    shift_date: '2026-06-01',
    shift_type_id: 10,
    doctor_id: null,
    is_pinned: false,
    is_locked: false,
    notes: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    shift_type: BASE_SHIFT_TYPE,
    doctor: null,
    conflicts: [],
    ...overrides,
  }
}

function makeDoctor(id: number, name: string): Doctor {
  return {
    id,
    name,
    doctor_type: 'INTERNAL',
    is_facharzt: false,
    active: true,
    title: null,
    short_name: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    employment_periods: [],
    qualifications: [],
  } as unknown as Doctor
}

describe('buildSolverDiff', () => {
  it('leeres proposed-Array → keine Zeilen', () => {
    expect(buildSolverDiff([makeShift(1)], [], [])).toEqual([])
  })

  it('Nicht-Änderung (gleiches doctor_id) wird gefiltert', () => {
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: 5 }]
    expect(buildSolverDiff([makeShift(1, { doctor_id: 5 })], [], proposed)).toHaveLength(0)
  })

  it('Änderung von null → doctor wird erkannt', () => {
    const doc = makeDoctor(7, 'Anna Müller')
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: 7 }]
    const rows = buildSolverDiff([makeShift(1)], [doc], proposed)
    expect(rows).toHaveLength(1)
    expect(rows[0].current_doctor_name).toBeNull()
    expect(rows[0].proposed_doctor_name).toBe('Anna Müller')
    expect(rows[0].is_unassign).toBe(false)
  })

  it('Unassign (doctor_id null in proposal) wird erkannt', () => {
    const shiftDoc = { id: 3, name: 'Max Schmidt' } as ShiftWithDetails['doctor']
    const shift = makeShift(1, { doctor_id: 3, doctor: shiftDoc })
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: null }]
    const rows = buildSolverDiff([shift], [], proposed)
    expect(rows).toHaveLength(1)
    expect(rows[0].current_doctor_name).toBe('Max Schmidt')
    expect(rows[0].proposed_doctor_name).toBeNull()
    expect(rows[0].is_unassign).toBe(true)
  })

  it('unbekannte shift_id in proposed wird übersprungen', () => {
    const proposed: ProposedAssignment[] = [{ shift_id: 999, doctor_id: 7 }]
    expect(buildSolverDiff([makeShift(1)], [], proposed)).toHaveLength(0)
  })

  it('Sortierung: nach shift_date ASC, dann shift_type_order ASC', () => {
    const stT = { ...BASE_SHIFT_TYPE, id: 10, display_order: 1 }
    const stN = { ...BASE_SHIFT_TYPE, id: 11, name: 'Nachtdienst', short_name: 'N', display_order: 2 }
    const shifts = [
      makeShift(2, { shift_date: '2026-06-02', shift_type: stN }),
      makeShift(1, { shift_date: '2026-06-01', shift_type: stT }),
      makeShift(3, { shift_date: '2026-06-01', shift_type: stN }),
    ]
    const doc = makeDoctor(5, 'A B')
    const proposed: ProposedAssignment[] = [
      { shift_id: 2, doctor_id: 5 },
      { shift_id: 1, doctor_id: 5 },
      { shift_id: 3, doctor_id: 5 },
    ]
    const rows = buildSolverDiff(shifts, [doc], proposed)
    expect(rows.map((r) => r.shift_id)).toEqual([1, 3, 2])
  })
})
