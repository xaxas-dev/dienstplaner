import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { SpringerAssignment } from '@/lib/types'

export const springerKeys = {
  byPlan: (planId: number) => ['springer-assignments', planId] as const,
}

export function usePlanSpringerAssignments(planId: number | null) {
  return useQuery({
    queryKey: springerKeys.byPlan(planId ?? 0),
    queryFn: () => apiGet<SpringerAssignment[]>(`/api/plans/${planId}/springer-assignments`),
    enabled: planId != null && planId > 0,
  })
}

interface CreateSpringerParams {
  planId: number
  shiftDate: string
  doctorId: number
  targetDepartmentId: number
}

export function useCreateSpringerAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, shiftDate, doctorId, targetDepartmentId }: CreateSpringerParams) =>
      apiPost<SpringerAssignment>(`/api/plans/${planId}/springer-assignments`, {
        shift_date: shiftDate,
        doctor_id: doctorId,
        target_department_id: targetDepartmentId,
      }),
    onSuccess: (_data, { planId }) => {
      queryClient.invalidateQueries({ queryKey: springerKeys.byPlan(planId) })
    },
  })
}

export function useDeleteSpringerAssignment(planId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/springer-assignments/${assignmentId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete fehlgeschlagen')
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: springerKeys.byPlan(planId) })
    },
  })
}
