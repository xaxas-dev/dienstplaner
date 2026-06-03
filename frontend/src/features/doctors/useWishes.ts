import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Wish, WishCreateBody, WishUpdate } from '@/lib/types'

export const wishKeys = {
  byDoctor: (doctorId: number) => ['wishes', 'doctor', doctorId] as const,
}

export function useWishesByDoctor(doctorId: number) {
  return useQuery({
    queryKey: wishKeys.byDoctor(doctorId),
    queryFn: () => apiGet<Wish[]>(`/api/doctors/${doctorId}/wishes`),
  })
}

export function useCreateWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WishCreateBody) =>
      apiPost<Wish>(`/api/doctors/${doctorId}/wishes`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}

export function useUpdateWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WishUpdate }) =>
      apiPatch<Wish>(`/api/wishes/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}

export function useDeleteWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/wishes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}
