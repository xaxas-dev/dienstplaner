import type { Absence, AbsenceType, Department, RotationAssignmentWithDetails, ShiftWithDetails } from '@/lib/types'

// ── Row-Typen ──────────────────────────────────────────────────────────────────

export interface HeaderRow {
  kind: 'header'
  department: Department
  rowKey: string
}

export interface PlaceholderRow {
  kind: 'placeholder'
  department: Department
  rowKey: string
}

export interface RotationRow {
  kind: 'rotation'
  department: Department
  doctor: NonNullable<RotationAssignmentWithDetails['doctor']>
  rotation: RotationAssignmentWithDetails
  rowKey: string
}

export type UnifiedRow = HeaderRow | PlaceholderRow | RotationRow

// ── Row-Derivation ─────────────────────────────────────────────────────────────

export function buildUnifiedRows(
  departments: Department[],
  rotations: RotationAssignmentWithDetails[],
): UnifiedRow[] {
  const rows: UnifiedRow[] = []

  const activeDepts = [...departments]
    .filter((d) => d.active)
    .sort((a, b) => a.display_order - b.display_order)

  for (const dept of activeDepts) {
    rows.push({ kind: 'header', department: dept, rowKey: `header-${dept.id}` })

    const deptRotations = rotations
      .filter((r) => r.department_id === dept.id && r.doctor != null)
      .sort((a, b) => {
        const nameA = a.doctor?.name ?? ''
        const nameB = b.doctor?.name ?? ''
        const nameCmp = nameA.localeCompare(nameB, 'de')
        return nameCmp !== 0 ? nameCmp : a.valid_from.localeCompare(b.valid_from)
      })

    if (deptRotations.length === 0) {
      rows.push({ kind: 'placeholder', department: dept, rowKey: `placeholder-${dept.id}` })
    } else {
      for (const rot of deptRotations) {
        rows.push({
          kind: 'rotation',
          department: dept,
          doctor: rot.doctor!,
          rotation: rot,
          rowKey: `rot-${rot.id}`,
        })
      }
    }
  }

  return rows
}

// ── Absence-Code-Mapping ───────────────────────────────────────────────────────

const ABSENCE_CODES: Record<AbsenceType, string> = {
  URLAUB: 'U',
  KRANKHEIT: 'K',
  FORTBILDUNG: 'Fo',
  ELTERNZEIT: 'EZ',
  MUTTERSCHUTZ: 'MuSchu',
  SONSTIGES: 'DIV',
}

export function absenceCode(absenceType: AbsenceType): string {
  return ABSENCE_CODES[absenceType] ?? absenceType
}

// ── Cell-Resolver ──────────────────────────────────────────────────────────────

export interface ResolvedCell {
  inRotation: boolean
  text: string
  shiftId: number | null
  absenceId: number | null
}

export function resolveCell(
  row: RotationRow,
  dayKey: string,
  shifts: ShiftWithDetails[],
  absences: Absence[],
): ResolvedCell {
  const inRotation = dayKey >= row.rotation.valid_from && dayKey <= row.rotation.valid_to

  const absence = absences.find(
    (a) => a.doctor_id === row.doctor.id && a.valid_from <= dayKey && a.valid_to >= dayKey,
  )

  const shift = shifts.find(
    (s) => s.doctor_id === row.doctor.id && s.shift_date === dayKey,
  )

  const text = absence
    ? absenceCode(absence.absence_type)
    : shift?.shift_type?.short_name ?? ''

  return {
    inRotation,
    text,
    shiftId: shift?.id ?? null,
    absenceId: absence?.id ?? null,
  }
}
