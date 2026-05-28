// frontend/src/features/plans/useDeleteAbsence.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiDelete } from '@/lib/api'
import { planAbsenceKeys } from './usePlanAbsences'

export function useDeleteAbsence(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (absenceId: number) => apiDelete(`/api/absences/${absenceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      // Invalidiert alle Availability-Queries (Absence ist INA-Quelle)
      qc.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}
