import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Qualification, QualificationCreate, QualificationUpdate } from '@/lib/types'

export const qualificationKeys = {
  all: ['qualifications'] as const,
  list: (includeInactive: boolean) => ['qualifications', { includeInactive }] as const,
  detail: (id: number) => ['qualification', id] as const,
}

export function useQualifications(includeInactive = false) {
  return useQuery({
    queryKey: qualificationKeys.list(includeInactive),
    queryFn: () =>
      apiGet<Qualification[]>(`/api/qualifications?include_inactive=${includeInactive}`),
  })
}

export function useCreateQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: QualificationCreate) =>
      apiPost<Qualification>('/api/qualifications', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qualificationKeys.all })
    },
  })
}

export function useUpdateQualification(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: QualificationUpdate) =>
      apiPatch<Qualification>(`/api/qualifications/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qualificationKeys.all })
      void qc.invalidateQueries({ queryKey: qualificationKeys.detail(id) })
    },
  })
}

export function useDeleteQualification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/qualifications/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qualificationKeys.all })
    },
  })
}
