import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { ShiftType, ShiftTypeCreate, ShiftTypeUpdate } from '@/lib/types'

export const shiftTypeKeys = {
  all: ['shiftTypes'] as const,
  list: (includeInactive: boolean) => ['shiftTypes', { includeInactive }] as const,
  detail: (id: number) => ['shiftType', id] as const,
}

export function useShiftTypes(includeInactive = false) {
  return useQuery({
    queryKey: shiftTypeKeys.list(includeInactive),
    queryFn: () =>
      apiGet<ShiftType[]>(`/api/shift-types?include_inactive=${includeInactive}`),
  })
}

export function useCreateShiftType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftTypeCreate) => apiPost<ShiftType>('/api/shift-types', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftTypeKeys.all })
    },
  })
}

export function useUpdateShiftType(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftTypeUpdate) => apiPatch<ShiftType>(`/api/shift-types/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftTypeKeys.all })
      void qc.invalidateQueries({ queryKey: shiftTypeKeys.detail(id) })
    },
  })
}

export function useDeleteShiftType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/shift-types/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftTypeKeys.all })
    },
  })
}
