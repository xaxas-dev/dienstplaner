import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { INAExclusion, INAExclusionCreate, INAExclusionUpdate } from '@/lib/types'

const inaExclusionKeys = {
  all: (doctorId: number) => ['ina-exclusions', doctorId] as const,
}

export function useINAExclusions(doctorId: number) {
  return useQuery({
    queryKey: inaExclusionKeys.all(doctorId),
    queryFn: () => apiGet<INAExclusion[]>(`/api/doctors/${doctorId}/ina-exclusions`),
  })
}

export function useCreateINAExclusion(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: INAExclusionCreate) =>
      apiPost<INAExclusion>(`/api/doctors/${doctorId}/ina-exclusions`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inaExclusionKeys.all(doctorId) })
    },
  })
}

export function useUpdateINAExclusion(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: INAExclusionUpdate }) =>
      apiPatch<INAExclusion>(`/api/ina-exclusions/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inaExclusionKeys.all(doctorId) })
    },
  })
}

export function useDeleteINAExclusion(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/ina-exclusions/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inaExclusionKeys.all(doctorId) })
    },
  })
}
