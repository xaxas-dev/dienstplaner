import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import type { ConstraintOverride, ConstraintOverrideCreateB } from '@/lib/types'

export const doctorOverrideKeys = {
  byDoctor: (doctorId: number) =>
    ['constraint-overrides', 'doctor', doctorId] as const,
} as const

export function useDoctorConstraintOverrides(doctorId: number | null) {
  return useQuery({
    queryKey: doctorOverrideKeys.byDoctor(doctorId ?? 0),
    queryFn: () =>
      apiGet<ConstraintOverride[]>(
        `/api/doctors/${doctorId}/constraint-overrides`,
      ),
    enabled: doctorId != null,
  })
}

export function useCreateDoctorConstraintOverride(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConstraintOverrideCreateB) =>
      apiPost<ConstraintOverride>('/api/constraint-overrides', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorOverrideKeys.byDoctor(doctorId) })
    },
  })
}

export function useDeleteDoctorConstraintOverride(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrideId: number) =>
      apiDelete(`/api/constraint-overrides/${overrideId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorOverrideKeys.byDoctor(doctorId) })
    },
  })
}
