import { eachDayOfInterval, format } from 'date-fns'
import type { Department, RotationAssignmentWithDetails } from '@/lib/types'

export interface RotationGridCell {
  assignment: RotationAssignmentWithDetails
  isEinarbeitung: boolean
  overlap: boolean
}

export interface RotationGridRow {
  department: Department
  cells: Record<string, RotationGridCell>
}

export interface RotationGridData {
  rows: RotationGridRow[]
  days: Date[]
}

export function buildRotationGridData(
  rotations: RotationAssignmentWithDetails[],
  departments: Department[],
  validFrom: string,
  validTo: string,
): RotationGridData {
  const days = eachDayOfInterval({
    start: new Date(validFrom),
    end: new Date(validTo),
  })

  const activeDepts = [...departments]
    .filter((d) => d.active)
    .sort((a, b) => a.display_order - b.display_order)

  const rows: RotationGridRow[] = activeDepts.map((dept) => {
    const cells: Record<string, RotationGridCell> = {}

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd')

      const matching = rotations.filter(
        (ra) =>
          ra.department_id === dept.id &&
          ra.valid_from <= dayKey &&
          ra.valid_to >= dayKey,
      )

      if (matching.length === 0) continue

      const first = matching[0]
      cells[dayKey] = {
        assignment: first,
        isEinarbeitung: first.is_einarbeitung,
        overlap: matching.length > 1,
      }
    }

    return { department: dept, cells }
  })

  return { rows, days }
}
