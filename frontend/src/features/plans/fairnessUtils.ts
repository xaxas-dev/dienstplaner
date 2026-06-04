import type { ShiftWithDetails, RotationAssignmentWithDetails, Doctor } from '@/lib/types'

export interface FairnessStat {
  doctorId: number
  doctorName: string
  shortName: string | null
  total: number
  byGroup: Record<string, number>
}

export function buildFairnessStats(
  shifts: ShiftWithDetails[],
  rotations: RotationAssignmentWithDetails[],
  doctors: Doctor[],
): { stats: FairnessStat[]; groups: string[] } {
  const rotationDoctorIds = new Set(rotations.map((r) => r.doctor_id))

  const groups = [
    ...new Set(
      shifts
        .map((s) => s.shift_type?.filter_group)
        .filter((g): g is string => g != null && g !== ''),
    ),
  ].sort()

  const statsByDoctor = new Map<number, FairnessStat>()
  for (const doctorId of rotationDoctorIds) {
    const doctor = doctors.find((d) => d.id === doctorId)
    if (!doctor) continue
    statsByDoctor.set(doctorId, {
      doctorId,
      doctorName: doctor.name,
      shortName: doctor.short_name ?? null,
      total: 0,
      byGroup: Object.fromEntries(groups.map((g) => [g, 0])),
    })
  }

  for (const shift of shifts) {
    if (shift.doctor_id == null) continue
    const stat = statsByDoctor.get(shift.doctor_id)
    if (!stat) continue
    stat.total++
    const group = shift.shift_type?.filter_group
    if (group && group in stat.byGroup) {
      stat.byGroup[group]++
    }
  }

  const stats = [...statsByDoctor.values()].sort((a, b) =>
    a.doctorName.localeCompare(b.doctorName, 'de'),
  )

  return { stats, groups }
}
