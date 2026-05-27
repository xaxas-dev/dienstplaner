import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { PlanUpdate, PlanWithRelations } from '@/lib/types'
import { planKeys } from './usePlans'

export function useUpdatePlan(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanUpdate) =>
      apiPatch<PlanWithRelations>(`/api/plans/${planId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.detail(planId) })
      void qc.invalidateQueries({ queryKey: planKeys.list() })
    },
  })
}
