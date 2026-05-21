import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { PlanTarifWarnings } from '@/lib/types'

export const tarifWarningKeys = {
  byPlan: (planId: number) => ['tarif-warnings', 'plan', planId] as const,
}

export function useTarifWarnings(planId: number | null) {
  return useQuery({
    queryKey: tarifWarningKeys.byPlan(planId ?? 0),
    queryFn: () => apiGet<PlanTarifWarnings>(`/api/plans/${planId}/tarif-warnings`),
    enabled: planId !== null,
  })
}
