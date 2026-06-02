import { describe, expect, it } from 'vitest'
import { buildUnifiedRows, resolveCell, absenceCode } from '../unifiedGridUtils'
import type { Department, RotationAssignmentWithDetails, ShiftWithDetails, Absence } from '@/lib/types'

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeDept(overrides: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'ITS',
    short_name: 'ITS',
    is_external: false,
    is_shift_relevant: true,
    active: true,
    display_order: 1,
    requires_full_time: false,
    min_headcount: null,
    max_headcount: null,
    blocks_ina_weekdays: false,
    blocks_ina_weekends: false,
    notes: null,
    color: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

function makeRotation(
  overrides: Partial<RotationAssignmentWithDetails> & {
    doctor?: RotationAssignmentWithDetails['doctor']
  } = {},
): RotationAssignmentWithDetails {
  return {
    id: 1,
    plan_id: 10,
    doctor_id: 100,
    department_id: 1,
    valid_from: '2026-05-01',
    valid_to: '2026-05-31',
    is_einarbeitung: false,
    notes: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    doctor: {
      id: 100,
      name: 'Dr. Muster',
      title: null,
      short_name: 'Mu',
      doctor_type: 'INTERNAL',
      is_facharzt: false,
      active: true,
      entry_date: null,
      weiterbildungsjahr: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    },
    department: null,
    ...overrides,
  }
}

// ── buildUnifiedRows ───────────────────────────────────────────────────────────

describe('buildUnifiedRows', () => {
  it('leerer Bereich → header + placeholder', () => {
    const rows = buildUnifiedRows([makeDept()], [])
    expect(rows).toHaveLength(2)
    expect(rows[0].kind).toBe('header')
    expect(rows[1].kind).toBe('placeholder')
  })

  it('Bereich mit einer Rotation → header + rotation', () => {
    const dept = makeDept({ id: 1 })
    const rot = makeRotation({ department_id: 1 })
    const rows = buildUnifiedRows([dept], [rot])
    expect(rows).toHaveLength(2)
    expect(rows[0].kind).toBe('header')
    expect(rows[1].kind).toBe('rotation')
    if (rows[1].kind === 'rotation') {
      expect(rows[1].rotation.id).toBe(1)
    }
  })

  it('zwei Rotationen im gleichen Bereich → header + 2 rotation rows', () => {
    const dept = makeDept({ id: 1 })
    const rot1 = makeRotation({ id: 1, doctor_id: 100, department_id: 1 })
    const rot2 = makeRotation({
      id: 2,
      doctor_id: 101,
      department_id: 1,
      doctor: { id: 101, name: 'Dr. Zweiter', title: null, short_name: null, doctor_type: 'INTERNAL', is_facharzt: false, active: true, entry_date: null, weiterbildungsjahr: null, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' },
    })
    const rows = buildUnifiedRows([dept], [rot1, rot2])
    expect(rows).toHaveLength(3)
    expect(rows.filter((r) => r.kind === 'rotation')).toHaveLength(2)
  })

  it('Doctor mit 2 Rotationen in 2 verschiedenen Bereichen → je 1 Zeile pro Bereich', () => {
    const dept1 = makeDept({ id: 1, name: 'ITS', display_order: 1 })
    const dept2 = makeDept({ id: 2, name: 'SU', display_order: 2 })
    const rot1 = makeRotation({ id: 1, department_id: 1, valid_from: '2026-05-01', valid_to: '2026-05-15' })
    const rot2 = makeRotation({ id: 2, department_id: 2, valid_from: '2026-05-16', valid_to: '2026-05-31' })
    const rows = buildUnifiedRows([dept1, dept2], [rot1, rot2])
    const rotationRows = rows.filter((r) => r.kind === 'rotation')
    expect(rotationRows).toHaveLength(2)
    if (rotationRows[0].kind === 'rotation') expect(rotationRows[0].department.id).toBe(1)
    if (rotationRows[1].kind === 'rotation') expect(rotationRows[1].department.id).toBe(2)
  })

  it('inaktive Bereiche werden nicht gerendert', () => {
    const active = makeDept({ id: 1, active: true })
    const inactive = makeDept({ id: 2, active: false })
    const rows = buildUnifiedRows([active, inactive], [])
    const deptIds = rows.map((r) => r.department.id)
    expect(deptIds).not.toContain(2)
  })

  it('sortiert nach display_order', () => {
    const deptB = makeDept({ id: 2, name: 'B', display_order: 2 })
    const deptA = makeDept({ id: 1, name: 'A', display_order: 1 })
    const rows = buildUnifiedRows([deptB, deptA], [])
    expect(rows[0].department.id).toBe(1)
    expect(rows[2].department.id).toBe(2)
  })
})

// ── resolveCell ────────────────────────────────────────────────────────────────

describe('resolveCell', () => {
  const dept = makeDept({ id: 1 })
  const rot = makeRotation({ department_id: 1 })
  const row = { kind: 'rotation' as const, department: dept, doctor: rot.doctor!, rotation: rot, rowKey: 'rot-1' }

  it('innerhalb Rotation ohne Shift/Absence → inRotation=true, text=""', () => {
    const cell = resolveCell(row, '2026-05-10', [], [])
    expect(cell.inRotation).toBe(true)
    expect(cell.text).toBe('')
  })

  it('außerhalb Rotation → inRotation=false', () => {
    const cell = resolveCell(row, '2026-06-01', [], [])
    expect(cell.inRotation).toBe(false)
  })

  it('Shift vorhanden → text = short_name', () => {
    const shift: ShiftWithDetails = {
      id: 50,
      plan_id: 10,
      shift_date: '2026-05-10',
      shift_type_id: 1,
      doctor_id: 100,
      is_pinned: false,
      is_locked: false,
      notes: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
      shift_type: { id: 1, name: 'V-Dienst', short_name: 'V', applies_on_weekdays: true, applies_on_weekend: false, display_order: 1, active: true, is_bereitschaftsdienst: false, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' },
      conflicts: [],
    }
    const cell = resolveCell(row, '2026-05-10', [shift], [])
    expect(cell.text).toBe('V')
    expect(cell.shiftId).toBe(50)
  })

  it('Absence hat Vorrang vor Shift', () => {
    const shift: ShiftWithDetails = {
      id: 50,
      plan_id: 10,
      shift_date: '2026-05-10',
      shift_type_id: 1,
      doctor_id: 100,
      is_pinned: false,
      is_locked: false,
      notes: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
      shift_type: { id: 1, name: 'V-Dienst', short_name: 'V', applies_on_weekdays: true, applies_on_weekend: false, display_order: 1, active: true, is_bereitschaftsdienst: false, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' },
      conflicts: [],
    }
    const absence: Absence = {
      id: 99,
      doctor_id: 100,
      absence_type: 'URLAUB',
      valid_from: '2026-05-08',
      valid_to: '2026-05-15',
      notes: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    }
    const cell = resolveCell(row, '2026-05-10', [shift], [absence])
    expect(cell.text).toBe('U')
    expect(cell.absenceId).toBe(99)
  })

  it('Absence eines anderen Arztes ignoriert', () => {
    const absence: Absence = {
      id: 99,
      doctor_id: 999, // anderer Arzt
      absence_type: 'URLAUB',
      valid_from: '2026-05-08',
      valid_to: '2026-05-15',
      notes: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    }
    const cell = resolveCell(row, '2026-05-10', [], [absence])
    expect(cell.text).toBe('')
    expect(cell.absenceId).toBeNull()
  })
})

// ── absenceCode ────────────────────────────────────────────────────────────────

describe('absenceCode', () => {
  it.each([
    ['URLAUB', 'U'],
    ['KRANKHEIT', 'K'],
    ['FORTBILDUNG', 'Fo'],
    ['ELTERNZEIT', 'EZ'],
    ['MUTTERSCHUTZ', 'MuSchu'],
    ['SONSTIGES', 'DIV'],
  ] as const)('%s → %s', (type, expected) => {
    expect(absenceCode(type)).toBe(expected)
  })
})
