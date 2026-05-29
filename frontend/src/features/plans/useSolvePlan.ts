import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import type { SolveResult } from '@/lib/types'

export class JvmUnavailableError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'JvmUnavailableError'
  }
}

export function useSolvePlan(planId: number) {
  return useMutation({
    mutationFn: async (): Promise<SolveResult> => {
      try {
        return await apiPost<SolveResult>(`/api/plans/${planId}/solve`, {})
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          throw new JvmUnavailableError(err.detail)
        }
        throw err
      }
    },
  })
}
