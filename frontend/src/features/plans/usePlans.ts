import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { Plan, PlanCreate, PlanWithRelations } from '@/lib/types'

export const planKeys = {
  all: ['plans'] as const,
  list: () => ['plans', 'list'] as const,
  detail: (id: number) => ['plans', id] as const,
}

export function usePlans() {
  return useQuery({
    queryKey: planKeys.list(),
    queryFn: () => apiGet<Plan[]>('/api/plans'),
  })
}

export function usePlan(planId: number) {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => apiGet<PlanWithRelations>(`/api/plans/${planId}`),
    enabled: !isNaN(planId) && planId > 0,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanCreate) =>
      apiPost<PlanWithRelations>('/api/plans', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}
