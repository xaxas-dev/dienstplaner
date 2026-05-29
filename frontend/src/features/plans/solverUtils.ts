import type { ShiftWithDetails, ProposedAssignment, Doctor } from '@/lib/types'

export interface SolverDiffRow {
  shift_id: number
  shift_date: string
  shift_type_name: string
  shift_type_order: number
  current_doctor_name: string | null
  proposed_doctor_name: string | null
  is_unassign: boolean
}

function doctorName(d: { name: string } | null | undefined): string | null {
  if (!d) return null
  return d.name
}

export function buildSolverDiff(
  shifts: ShiftWithDetails[],
  doctors: Doctor[],
  proposed: ProposedAssignment[],
): SolverDiffRow[] {
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const doctorById = new Map(doctors.map((d) => [d.id, d]))

  const rows: SolverDiffRow[] = []

  for (const p of proposed) {
    const shift = shiftById.get(p.shift_id)
    if (!shift) continue

    const currentDoctorId = shift.doctor_id ?? null
    const proposedDoctorId = p.doctor_id ?? null

    if (currentDoctorId === proposedDoctorId) continue

    const proposedDoctor = proposedDoctorId !== null ? doctorById.get(proposedDoctorId) : undefined

    rows.push({
      shift_id: shift.id,
      shift_date: shift.shift_date,
      shift_type_name: shift.shift_type?.name ?? `ShiftType ${shift.shift_type_id}`,
      shift_type_order: shift.shift_type?.display_order ?? 0,
      current_doctor_name: doctorName(shift.doctor),
      proposed_doctor_name: doctorName(proposedDoctor),
      is_unassign: proposedDoctorId === null,
    })
  }

  rows.sort((a, b) => {
    const dateCompare = a.shift_date.localeCompare(b.shift_date)
    if (dateCompare !== 0) return dateCompare
    return a.shift_type_order - b.shift_type_order
  })

  return rows
}
