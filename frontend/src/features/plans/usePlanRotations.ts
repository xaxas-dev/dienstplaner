import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type {
  RotationAssignment,
  RotationAssignmentWithDetails,
  RotationAssignmentCreate,
  RotationAssignmentUpdate,
} from '@/lib/types'
import { conflictQueryKeys } from './usePlanConflicts'
import { shiftQueryKeys } from './usePlanShifts'

export const rotationQueryKeys = {
  byPlan: (planId: number) => ['rotations', 'plan', planId] as const,
}

function invalidateRotationRelated(qc: QueryClient, planId: number) {
  void qc.invalidateQueries({ queryKey: rotationQueryKeys.byPlan(planId) })
  void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
  void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
}

export function usePlanRotations(planId: number) {
  return useQuery({
    queryKey: rotationQueryKeys.byPlan(planId),
    queryFn: () => apiGet<RotationAssignmentWithDetails[]>(`/api/plans/${planId}/rotations`),
  })
}

export function useCreateRotation(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RotationAssignmentCreate) =>
      apiPost<RotationAssignment>(`/api/plans/${planId}/rotations`, data),
    onSuccess: () => {
      invalidateRotationRelated(qc, planId)
    },
  })
}

export function useUpdateRotation(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rotationId, data }: { rotationId: number; data: RotationAssignmentUpdate }) =>
      apiPatch<RotationAssignment>(`/api/rotations/${rotationId}`, data),
    onSuccess: () => {
      invalidateRotationRelated(qc, planId)
    },
  })
}

export function useDeleteRotation(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rotationId: number) => apiDelete(`/api/rotations/${rotationId}`),
    onSuccess: () => {
      invalidateRotationRelated(qc, planId)
    },
  })
}
