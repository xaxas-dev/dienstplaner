import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { ShiftUpdate, ShiftWithDetails } from '@/lib/types'
import { shiftQueryKeys } from './usePlanShifts'
import { conflictQueryKeys } from './usePlanConflicts'
import { tarifWarningKeys } from './useTarifWarnings'

export function useAssignShift(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: number; data: ShiftUpdate }) =>
      apiPatch<ShiftWithDetails>(`/api/shifts/${shiftId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}
