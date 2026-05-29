import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import type { ApplyResult, ProposedAssignment } from '@/lib/types'
import { shiftQueryKeys } from './usePlanShifts'
import { conflictQueryKeys } from './usePlanConflicts'
import { tarifWarningKeys } from './useTarifWarnings'

export function useApplySolverResult(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (proposed_assignments: ProposedAssignment[]): Promise<ApplyResult> =>
      apiPost<ApplyResult>(`/api/plans/${planId}/apply`, { proposed_assignments }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}
