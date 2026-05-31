import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import type { ConstraintOverride, ConstraintOverrideCreate } from '@/lib/types'
import { tarifWarningKeys } from './useTarifWarnings'

export const overrideKeys = {
  byPlan: (planId: number) => ['constraint-overrides', 'plan', planId] as const,
} as const

export function useConstraintOverrides(planId: number | null) {
  return useQuery({
    queryKey: overrideKeys.byPlan(planId ?? 0),
    queryFn: () =>
      apiGet<ConstraintOverride[]>(`/api/constraint-overrides?plan_id=${planId}`),
    enabled: planId != null,
  })
}

export function useCreateConstraintOverride(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConstraintOverrideCreate) =>
      apiPost<ConstraintOverride>('/api/constraint-overrides', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: overrideKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}

export function useDeleteConstraintOverride(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrideId: number) =>
      apiDelete(`/api/constraint-overrides/${overrideId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: overrideKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}
