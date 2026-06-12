import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPostFormData } from '@/lib/api'
import type { ImportAnalysis } from '@/lib/importTypes'
import { planKeys } from './usePlans'
import { rotationQueryKeys } from './usePlanRotations'
import { planAbsenceKeys } from './usePlanAbsences'
import { shiftQueryKeys } from './usePlanShifts'

export function useAnalyzeImport() {
  return useMutation({
    mutationFn: async (file: File): Promise<ImportAnalysis> => {
      const fd = new FormData()
      fd.append('file', file)
      return apiPostFormData<ImportAnalysis>('/api/imports/besetzungsplan/analyze', fd)
    },
  })
}

export function useCommitImport(planId?: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file,
      resolutions,
    }: {
      file: File
      resolutions: object
    }): Promise<unknown> => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('resolutions', JSON.stringify(resolutions))
      return apiPostFormData('/api/imports/besetzungsplan/commit', fd)
    },
    onSuccess: () => {
      // Invalidate everything that could change after a full import
      void qc.invalidateQueries({ queryKey: planKeys.all })
      void qc.invalidateQueries({ queryKey: ['doctors'] })
      void qc.invalidateQueries({ queryKey: ['departments'] })
      if (planId) {
        void qc.invalidateQueries({ queryKey: rotationQueryKeys.byPlan(planId) })
        void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
        void qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      }
    },
  })
}
