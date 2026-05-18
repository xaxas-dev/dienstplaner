import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { PlanConflicts } from '@/lib/types'

export const conflictQueryKeys = {
  byPlan: (planId: number) => ['conflicts', 'plan', planId] as const,
}

export function usePlanConflicts(planId: number) {
  return useQuery({
    queryKey: conflictQueryKeys.byPlan(planId),
    queryFn: () => apiGet<PlanConflicts>(`/api/plans/${planId}/conflicts`),
  })
}
