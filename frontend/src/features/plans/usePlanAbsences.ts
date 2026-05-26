import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { Absence } from '@/lib/types'

export const planAbsenceKeys = {
  byPlan: (planId: number) => ['absences', 'plan', planId] as const,
}

export function usePlanAbsences(planId: number) {
  return useQuery({
    queryKey: planAbsenceKeys.byPlan(planId),
    queryFn: () => apiGet<Absence[]>(`/api/plans/${planId}/absences`),
  })
}
