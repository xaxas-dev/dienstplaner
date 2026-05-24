import { useQuery } from '@tanstack/react-query'
import type { PlanWithRelations } from '@/lib/types'

export const currentPlanKeys = {
  all: ['currentPlan'] as const,
  byDate: (date: string) => ['currentPlan', date] as const,
}

async function fetchCurrentPlan(today?: string): Promise<PlanWithRelations | null> {
  const url = today ? `/api/plans/current?today=${today}` : '/api/plans/current'
  const res = await fetch(url)
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<PlanWithRelations>
}

export function useCurrentPlan(today?: string) {
  return useQuery({
    queryKey: today ? currentPlanKeys.byDate(today) : currentPlanKeys.all,
    queryFn: () => fetchCurrentPlan(today),
  })
}
