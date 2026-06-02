import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { shiftQueryKeys } from './usePlanShifts'

interface LockedWeekCreate {
  doctor_id: number
  start_date: string
  shift_type_id: number
}

interface LockedWeekResult {
  created: unknown[]
  skipped: number[]
}

export function useCreateLockedWeek(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LockedWeekCreate) =>
      apiPost<LockedWeekResult>(`/api/plans/${planId}/locked-week`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
    },
  })
}
