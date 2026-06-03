import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { Wish } from '@/lib/types'

export const planWishKeys = {
  byPlan: (planId: number) => ['plan-wishes', planId] as const,
}

export function usePlanWishes(planId: number | null) {
  return useQuery({
    queryKey: planWishKeys.byPlan(planId ?? 0),
    queryFn: () => apiGet<Wish[]>(`/api/plans/${planId}/wishes`),
    enabled: planId !== null,
  })
}
