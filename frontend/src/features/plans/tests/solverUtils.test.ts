import { describe, it, expect } from 'vitest'
import { buildSolverDiff } from '../solverUtils'
import type { ShiftWithDetails, Doctor, ProposedAssignment } from '@/lib/types'

function makeShift(overrides: Partial<ShiftWithDetails> & { id: number }): ShiftWithDetails {
  return {
    id: overrides.id,
    plan_id: 1,
    shift_date: '2026-06-01',
    shift_type_id: 10,
    doctor_id: null,
    is_pinned: false,
    notes: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    shift_type: { id: 10, name: 'Tagdienst', short_name: 'T', display_order: 1, active: true, notes: null, is_bereitschaftsdienst: false, created_at: '', updated_at: '' },
    doctor: null,
    conflicts: [],
    ...overrides,
  }
}

function makeDoctor(id: number, first: string, last: string): Doctor {
  return {
    id,
    first_name: first,
    last_name: last,
    type: 'INTERN',
    active: true,
    title: null,
    short_name: last.slice(0, 3).toUpperCase(),
    email: null,
    notes: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    employment_periods: [],
    qualifications: [],
  } as unknown as Doctor
}

describe('buildSolverDiff', () => {
  it('leeres proposed-Array → keine Zeilen', () => {
    const shifts = [makeShift({ id: 1 })]
    const doctors: Doctor[] = []
    expect(buildSolverDiff(shifts, doctors, [])).toEqual([])
  })

  it('Nicht-Änderung (gleiches doctor_id) wird gefiltert', () => {
    const shifts = [makeShift({ id: 1, doctor_id: 5 })]
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: 5 }]
    expect(buildSolverDiff(shifts, [], proposed)).toHaveLength(0)
  })

  it('Änderung von null → doctor wird erkannt', () => {
    const doc = makeDoctor(7, 'Anna', 'Müller')
    const shifts = [makeShift({ id: 1, doctor_id: null, doctor: null })]
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: 7 }]
    const rows = buildSolverDiff(shifts, [doc], proposed)
    expect(rows).toHaveLength(1)
    expect(rows[0].current_doctor_name).toBeNull()
    expect(rows[0].proposed_doctor_name).toBe('Anna Müller')
    expect(rows[0].is_unassign).toBe(false)
  })

  it('Unassign (doctor_id null in proposal) wird erkannt', () => {
    const shifts = [makeShift({ id: 1, doctor_id: 3, doctor: { id: 3, first_name: 'Max', last_name: 'Schmidt' } as ShiftWithDetails['doctor'] })]
    const proposed: ProposedAssignment[] = [{ shift_id: 1, doctor_id: null }]
    const rows = buildSolverDiff(shifts, [], proposed)
    expect(rows).toHaveLength(1)
    expect(rows[0].current_doctor_name).toBe('Max Schmidt')
    expect(rows[0].proposed_doctor_name).toBeNull()
    expect(rows[0].is_unassign).toBe(true)
  })

  it('unbekannte shift_id in proposed wird übersprungen', () => {
    const shifts = [makeShift({ id: 1 })]
    const proposed: ProposedAssignment[] = [{ shift_id: 999, doctor_id: 7 }]
    expect(buildSolverDiff(shifts, [], proposed)).toHaveLength(0)
  })

  it('Sortierung: nach shift_date ASC, dann shift_type_order ASC', () => {
    const shifts = [
      makeShift({ id: 2, shift_date: '2026-06-02', shift_type: { id: 11, name: 'Nachtdienst', short_name: 'N', display_order: 2, active: true, notes: null, is_bereitschaftsdienst: false, created_at: '', updated_at: '' } }),
      makeShift({ id: 1, shift_date: '2026-06-01', shift_type: { id: 10, name: 'Tagdienst', short_name: 'T', display_order: 1, active: true, notes: null, is_bereitschaftsdienst: false, created_at: '', updated_at: '' } }),
      makeShift({ id: 3, shift_date: '2026-06-01', shift_type: { id: 11, name: 'Nachtdienst', short_name: 'N', display_order: 2, active: true, notes: null, is_bereitschaftsdienst: false, created_at: '', updated_at: '' } }),
    ]
    const doc = makeDoctor(5, 'A', 'B')
    const proposed: ProposedAssignment[] = [
      { shift_id: 2, doctor_id: 5 },
      { shift_id: 1, doctor_id: 5 },
      { shift_id: 3, doctor_id: 5 },
    ]
    const rows = buildSolverDiff(shifts, [doc], proposed)
    expect(rows.map((r) => r.shift_id)).toEqual([1, 3, 2])
  })
})
