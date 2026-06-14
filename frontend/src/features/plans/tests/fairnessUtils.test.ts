import { describe, it, expect } from 'vitest'
import { buildFairnessStats } from '../fairnessUtils'
import type { ShiftWithDetails, RotationAssignmentWithDetails, Doctor } from '@/lib/types'
import type { components } from '@/lib/api-types'

type ShiftTypeResponse = components['schemas']['ShiftTypeResponse']

function makeShiftType(overrides: Partial<ShiftTypeResponse> = {}): ShiftTypeResponse {
  return {
    id: 1,
    name: 'Nachtdienst',
    short_name: 'N',
    applies_on_weekdays: true,
    applies_on_weekend: true,
    start_time: null,
    end_time: null,
    display_order: 0,
    active: true,
    notes: null,
    is_bereitschaftsdienst: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1,
    plan_id: 1,
    shift_date: '2026-06-01',
    shift_type_id: 1,
    is_pinned: false,
    is_locked: false,
    conflicts: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeRotation(overrides: Partial<RotationAssignmentWithDetails>): RotationAssignmentWithDetails {
  return {
    id: 1,
    plan_id: 1,
    doctor_id: 1,
    department_id: 1,
    valid_from: '2026-06-01',
    valid_to: '2026-06-30',
    is_einarbeitung: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeDoctor(overrides: Partial<Doctor>): Doctor {
  return {
    id: 1,
    name: 'Müller, Anna',
    short_name: 'AM',
    doctor_type: 'INTERNAL',
    rank: 'FACHARZT',
    active: true,
    weiterbildungsjahr: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    opt_out_bd_level: null,
    employment_periods: [],
    qualifications: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildFairnessStats', () => {
  it('counts shifts per doctor with filter_group breakdown', () => {
    const stNacht = makeShiftType({ id: 1, filter_group: 'Nacht' })
    const stTag = makeShiftType({ id: 2, filter_group: 'Tag' })

    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 1, shift_type_id: 1, shift_type: stNacht }),
      makeShift({ id: 2, doctor_id: 1, shift_type_id: 2, shift_type: stTag }),
      makeShift({ id: 3, doctor_id: 2, shift_type_id: 1, shift_type: stNacht }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [
      makeRotation({ id: 1, doctor_id: 1 }),
      makeRotation({ id: 2, doctor_id: 2 }),
    ]
    const doctors: Doctor[] = [
      makeDoctor({ id: 1, name: 'Müller, Anna', short_name: 'AM' }),
      makeDoctor({ id: 2, name: 'Schmidt, Bert', short_name: 'BS' }),
    ]

    const { stats, groups } = buildFairnessStats(shifts, rotations, doctors)

    expect(groups).toEqual(['Nacht', 'Tag'])

    const anna = stats.find((s) => s.doctorId === 1)!
    expect(anna.total).toBe(2)
    expect(anna.byGroup['Nacht']).toBe(1)
    expect(anna.byGroup['Tag']).toBe(1)

    const bert = stats.find((s) => s.doctorId === 2)!
    expect(bert.total).toBe(1)
    expect(bert.byGroup['Nacht']).toBe(1)
    expect(bert.byGroup['Tag']).toBe(0)
  })

  it('excludes shifts without doctor_id from all counts', () => {
    const st = makeShiftType({ filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: undefined, shift_type: st }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats[0].total).toBe(0)
  })

  it('counts shift without filter_group only in total, not in groups', () => {
    const stNoGroup = makeShiftType({ id: 1, filter_group: null })
    const stWithGroup = makeShiftType({ id: 2, filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 1, shift_type: stNoGroup }),
      makeShift({ id: 2, doctor_id: 1, shift_type: stWithGroup }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats, groups } = buildFairnessStats(shifts, rotations, doctors)

    expect(groups).toEqual(['Nacht'])
    expect(stats[0].total).toBe(2)
    expect(stats[0].byGroup['Nacht']).toBe(1)
  })

  it('includes doctor with rotation but zero shifts (all zeros)', () => {
    const shifts: ShiftWithDetails[] = []
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats).toHaveLength(1)
    expect(stats[0].total).toBe(0)
  })

  it('excludes doctors without rotation even if they have shifts', () => {
    const st = makeShiftType({ filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 99, shift_type: st }),
    ]
    const rotations: RotationAssignmentWithDetails[] = []
    const doctors: Doctor[] = [makeDoctor({ id: 99 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats).toHaveLength(0)
  })

  it('sorts stats alphabetically by doctor name', () => {
    const shifts: ShiftWithDetails[] = []
    const rotations: RotationAssignmentWithDetails[] = [
      makeRotation({ id: 1, doctor_id: 1 }),
      makeRotation({ id: 2, doctor_id: 2 }),
    ]
    const doctors: Doctor[] = [
      makeDoctor({ id: 1, name: 'Zander, Carla' }),
      makeDoctor({ id: 2, name: 'Auer, Stefan' }),
    ]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats[0].doctorName).toBe('Auer, Stefan')
    expect(stats[1].doctorName).toBe('Zander, Carla')
  })
})
