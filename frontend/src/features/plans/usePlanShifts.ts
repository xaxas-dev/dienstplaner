import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { ShiftWithDetails } from '@/lib/types'

export const shiftQueryKeys = {
  byPlan: (planId: number) => ['shifts', 'plan', planId] as const,
}

export function usePlanShifts(planId: number) {
  return useQuery({
    queryKey: shiftQueryKeys.byPlan(planId),
    queryFn: () => apiGet<ShiftWithDetails[]>(`/api/plans/${planId}/shifts`),
    enabled: !isNaN(planId) && planId > 0,
  })
}
