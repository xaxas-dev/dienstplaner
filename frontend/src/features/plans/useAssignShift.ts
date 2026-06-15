import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch, apiPost } from '@/lib/api'
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

export function useCreateShift(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { shift_type_id: number; shift_date: string; doctor_id: number | null }) =>
      apiPost<ShiftWithDetails>(`/api/plans/${planId}/shifts`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}

/**
 * Findet den Shift für einen bestimmten Tag+ShiftType aus dem Cache und gibt dessen ID zurück.
 * Null wenn kein passender Shift gefunden.
 */
export function findShiftId(
  shifts: ShiftWithDetails[],
  date: string,
  shiftTypeId: number,
): number | null {
  return shifts.find((s) => s.shift_date === date && s.shift_type_id === shiftTypeId)?.id ?? null
}
