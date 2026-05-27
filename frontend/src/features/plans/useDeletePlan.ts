import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiDelete } from '@/lib/api'
import { planKeys } from './usePlans'

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: number) => apiDelete(`/api/plans/${planId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}
