import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { buildRotationGridData } from '../rotationGridUtils'
import type { Department, RotationAssignmentWithDetails } from '@/lib/types'

function makeDept(id: number, display_order: number, active = true): Department {
  return {
    id,
    name: `Bereich ${id}`,
    short_name: `B${id}`,
    active,
    display_order,
    is_external: false,
    is_shift_relevant: true,
    requires_full_time: false,
    blocks_ina_weekdays: false,
    blocks_ina_weekends: false,
    min_headcount: null,
    max_headcount: null,
    notes: null,
    created_at: '',
    updated_at: '',
  } as Department
}

function makeRotation(
  overrides: Partial<RotationAssignmentWithDetails> & {
    id: number
    department_id: number
    valid_from: string
    valid_to: string
  },
): RotationAssignmentWithDetails {
  return {
    plan_id: 1,
    doctor_id: 1,
    is_einarbeitung: false,
    notes: null,
    created_at: '',
    updated_at: '',
    doctor: null,
    department: null,
    ...overrides,
  } as RotationAssignmentWithDetails
}

describe('buildRotationGridData', () => {
  it('Basis: ein Bereich, ein Arzt, ganzen Monat → alle Tage haben Zuweisung', () => {
    const dept = makeDept(1, 0)
    const ra = makeRotation({ id: 1, department_id: 1, valid_from: '2026-05-01', valid_to: '2026-05-31' })

    const { rows, days } = buildRotationGridData([ra], [dept], '2026-05-01', '2026-05-31')

    expect(days).toHaveLength(31)
    expect(rows).toHaveLength(1)

    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd')
      expect(rows[0].cells[key]).toBeDefined()
      expect(rows[0].cells[key].assignment.id).toBe(1)
    }
  })

  it('Leer: ein Bereich ohne Zuweisung → alle cells leer', () => {
    const dept = makeDept(1, 0)

    const { rows, days } = buildRotationGridData([], [dept], '2026-05-01', '2026-05-07')

    expect(days).toHaveLength(7)
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0].cells)).toHaveLength(0)
  })

  it('Zeitlich geteilt: zwei Ärzte nacheinander → korrekt pro Tag aufgelöst', () => {
    const dept = makeDept(1, 0)
    const raA = makeRotation({
      id: 1,
      department_id: 1,
      doctor_id: 10,
      valid_from: '2026-05-01',
      valid_to: '2026-05-15',
    })
    const raB = makeRotation({
      id: 2,
      department_id: 1,
      doctor_id: 20,
      valid_from: '2026-05-16',
      valid_to: '2026-05-31',
    })

    const { rows } = buildRotationGridData([raA, raB], [dept], '2026-05-01', '2026-05-31')

    expect(rows[0].cells['2026-05-01'].assignment.id).toBe(1)
    expect(rows[0].cells['2026-05-15'].assignment.id).toBe(1)
    expect(rows[0].cells['2026-05-16'].assignment.id).toBe(2)
    expect(rows[0].cells['2026-05-31'].assignment.id).toBe(2)
    expect(rows[0].cells['2026-05-01'].overlap).toBe(false)
    expect(rows[0].cells['2026-05-16'].overlap).toBe(false)
  })

  it('Überlappung: zwei Zuweisungen überlappen sich → erste gewinnt, overlap: true', () => {
    const dept = makeDept(1, 0)
    const ra1 = makeRotation({
      id: 1,
      department_id: 1,
      doctor_id: 10,
      valid_from: '2026-05-01',
      valid_to: '2026-05-31',
    })
    const ra2 = makeRotation({
      id: 2,
      department_id: 1,
      doctor_id: 20,
      valid_from: '2026-05-10',
      valid_to: '2026-05-20',
    })

    const { rows } = buildRotationGridData([ra1, ra2], [dept], '2026-05-01', '2026-05-31')

    // Days before overlap: ra1 only, no overlap
    expect(rows[0].cells['2026-05-05'].assignment.id).toBe(1)
    expect(rows[0].cells['2026-05-05'].overlap).toBe(false)

    // Days in overlap: first (ra1) wins, overlap: true
    expect(rows[0].cells['2026-05-15'].assignment.id).toBe(1)
    expect(rows[0].cells['2026-05-15'].overlap).toBe(true)
  })

  it('Sortierung: Departments nach display_order sortiert, nicht nach ID', () => {
    const deptC = makeDept(1, 3)
    const deptA = makeDept(2, 1)
    const deptB = makeDept(3, 2)

    const { rows } = buildRotationGridData([], [deptC, deptA, deptB], '2026-05-01', '2026-05-01')

    expect(rows[0].department.id).toBe(2) // display_order 1
    expect(rows[1].department.id).toBe(3) // display_order 2
    expect(rows[2].department.id).toBe(1) // display_order 3
  })

  it('Inaktiv: Department mit active: false erscheint NICHT in den Rows', () => {
    const active = makeDept(1, 0, true)
    const inactive = makeDept(2, 1, false)

    const { rows } = buildRotationGridData([], [active, inactive], '2026-05-01', '2026-05-01')

    expect(rows).toHaveLength(1)
    expect(rows[0].department.id).toBe(1)
  })

  it('is_einarbeitung-Flag: Zuweisung mit is_einarbeitung: true → Zelle hat isEinarbeitung: true', () => {
    const dept = makeDept(1, 0)
    const ra = makeRotation({
      id: 1,
      department_id: 1,
      valid_from: '2026-05-01',
      valid_to: '2026-05-31',
      is_einarbeitung: true,
    })

    const { rows } = buildRotationGridData([ra], [dept], '2026-05-01', '2026-05-31')

    expect(rows[0].cells['2026-05-10'].isEinarbeitung).toBe(true)
  })
})
