import { describe, it, expect } from 'vitest'
import { buildGridData } from '../planGridUtils'
import type { ShiftWithDetails, Doctor, ShiftType } from '@/lib/types'

const ST: ShiftType = {
  id: 1,
  name: 'Frühdienst',
  short_name: 'F',
  applies_on_weekdays: true,
  applies_on_weekend: false,
  start_time: null,
  end_time: null,
  display_order: 0,
  active: true,
  notes: null,
  created_at: '',
  updated_at: '',
}

function makeDoctor(id: number, name: string): Doctor {
  return {
    id,
    name,
    short_name: null,
    doctor_type: 'INTERNAL',
    is_facharzt: false,
    active: true,
    weiterbildungsjahr: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    created_at: '',
    updated_at: '',
    employment_periods: [],
    qualifications: [],
  }
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1,
    plan_id: 1,
    shift_date: '2026-05-01',
    shift_type_id: 1,
    doctor_id: null,
    is_pinned: false,
    notes: null,
    created_at: '',
    updated_at: '',
    shift_type: ST,
    doctor: null,
    conflicts: [],
    ...overrides,
  }
}

describe('buildGridData', () => {
  it('generiert alle Tage im Zeitraum', () => {
    const { days } = buildGridData([], [], '2026-05-01', '2026-05-31')
    expect(days).toHaveLength(31)
    expect(days[0].getDate()).toBe(1)
    expect(days[30].getDate()).toBe(31)
  })

  it('erstellt eine Zeile pro Arzt', () => {
    const doctors = [makeDoctor(1, 'Müller, Anna'), makeDoctor(2, 'Schmidt, Ben')]
    const { rows } = buildGridData([], doctors, '2026-05-01', '2026-05-31')
    expect(rows).toHaveLength(2)
    expect(rows[0].doctor.id).toBe(1)
    expect(rows[1].doctor.id).toBe(2)
  })

  it('ordnet Shift dem richtigen Arzt und Tag zu', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const shift = makeShift({ id: 10, doctor_id: 1, shift_date: '2026-05-15' })
    const { rows } = buildGridData([shift], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.shifts[0].id).toBe(10)
  })

  it('setzt hasConflict wenn Shift einen Konflikt hat', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const shift = makeShift({
      id: 11,
      doctor_id: 1,
      shift_date: '2026-05-15',
      conflicts: [
        {
          shift_id: 11,
          conflict_type: 'not_available',
          message: 'Im Urlaub',
          doctor_id: 1,
          doctor_name: 'Müller, Anna',
          shift_date: '2026-05-15',
          shift_type_short_name: 'F',
        },
      ],
    })
    const { rows } = buildGridData([shift], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.hasConflict).toBe(true)
  })

  it('lässt Cell undefined wenn kein Shift vorhanden', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const { rows } = buildGridData([], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-10']).toBeUndefined()
  })

  it('sammelt offene Schichten (doctor_id=null) in openShiftsByDay', () => {
    const shift = makeShift({ id: 20, doctor_id: null, shift_date: '2026-05-10' })
    const { openShiftsByDay } = buildGridData([shift], [], '2026-05-01', '2026-05-31')
    expect(openShiftsByDay['2026-05-10']).toHaveLength(1)
    expect(openShiftsByDay['2026-05-10'][0].id).toBe(20)
  })

  it('gruppiert mehrere Shifts eines Arztes am selben Tag', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const s1 = makeShift({ id: 1, doctor_id: 1, shift_date: '2026-05-15', shift_type_id: 1 })
    const s2 = makeShift({ id: 2, doctor_id: 1, shift_date: '2026-05-15', shift_type_id: 2 })
    const { rows } = buildGridData([s1, s2], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.shifts).toHaveLength(2)
  })
})
