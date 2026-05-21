import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Absence, AbsenceCreate, AbsenceUpdate } from '@/lib/types'

export const absenceKeys = {
  all: (doctorId: number) => ['absences', doctorId] as const,
}

export function useAbsences(doctorId: number) {
  return useQuery({
    queryKey: absenceKeys.all(doctorId),
    queryFn: () => apiGet<Absence[]>(`/api/doctors/${doctorId}/absences`),
  })
}

export function useCreateAbsence(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AbsenceCreate) =>
      apiPost<Absence>(`/api/doctors/${doctorId}/absences`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: absenceKeys.all(doctorId) })
    },
  })
}

export function useUpdateAbsence(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AbsenceUpdate }) =>
      apiPatch<Absence>(`/api/absences/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: absenceKeys.all(doctorId) })
    },
  })
}

export function useDeleteAbsence(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/absences/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: absenceKeys.all(doctorId) })
    },
  })
}
