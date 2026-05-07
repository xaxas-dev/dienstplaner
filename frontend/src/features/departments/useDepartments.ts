import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/lib/types'

export const departmentKeys = {
  all: ['departments'] as const,
  list: (includeInactive: boolean) => ['departments', { includeInactive }] as const,
  detail: (id: number) => ['department', id] as const,
}

export function useDepartments(includeInactive = false) {
  return useQuery({
    queryKey: departmentKeys.list(includeInactive),
    queryFn: () =>
      apiGet<Department[]>(`/api/departments?include_inactive=${includeInactive}`),
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DepartmentCreate) => apiPost<Department>('/api/departments', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all })
    },
  })
}

export function useUpdateDepartment(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DepartmentUpdate) => apiPatch<Department>(`/api/departments/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all })
      void qc.invalidateQueries({ queryKey: departmentKeys.detail(id) })
    },
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/departments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all })
    },
  })
}
