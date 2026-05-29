import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useApplySolverResult } from '../useApplySolverResult'
import { shiftQueryKeys } from '../usePlanShifts'
import { conflictQueryKeys } from '../usePlanConflicts'
import { tarifWarningKeys } from '../useTarifWarnings'

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useApplySolverResult', () => {
  it('ruft POST /api/plans/{planId}/apply mit korrektem Body auf', async () => {
    const applyResult = { plan_id: 1, applied: [10, 11], skipped_pinned: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(applyResult), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const { result } = renderHook(() => useApplySolverResult(1), { wrapper: makeWrapper(qc) })

    const proposals = [{ shift_id: 10, doctor_id: 5 }, { shift_id: 11, doctor_id: null }]
    await act(async () => {
      result.current.mutate(proposals)
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/plans/1/apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ proposed_assignments: proposals }),
      }),
    )
    expect(result.current.data).toEqual(applyResult)
  })

  it('invalidiert shifts, conflicts und tarifWarnings nach onSuccess', async () => {
    const applyResult = { plan_id: 1, applied: [10], skipped_pinned: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(applyResult), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApplySolverResult(1), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate([{ shift_id: 10, doctor_id: 5 }])
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: shiftQueryKeys.byPlan(1) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: conflictQueryKeys.byPlan(1) })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tarifWarningKeys.byPlan(1) })
  })
})
