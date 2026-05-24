import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { DashboardSummary } from '@/lib/types'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  byPlan: (planId: number) => ['dashboard', planId] as const,
  byPlanAndDate: (planId: number, date: string) => ['dashboard', planId, date] as const,
}

export function useDashboardSummary(planId: number | null, today?: string) {
  return useQuery({
    queryKey: planId != null
      ? today
        ? dashboardKeys.byPlanAndDate(planId, today)
        : dashboardKeys.byPlan(planId)
      : dashboardKeys.all,
    queryFn: () => {
      const url = today
        ? `/api/plans/${planId}/dashboard?today=${today}`
        : `/api/plans/${planId}/dashboard`
      return apiGet<DashboardSummary>(url)
    },
    enabled: planId != null,
  })
}
