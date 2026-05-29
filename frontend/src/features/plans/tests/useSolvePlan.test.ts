import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSolvePlan, JvmUnavailableError } from '../useSolvePlan'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useSolvePlan', () => {
  it('ruft POST /api/plans/{planId}/solve auf', async () => {
    const solveResult = { plan_id: 1, proposed_assignments: [], hard_score: 0, soft_score: 0, feasible: true }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(solveResult), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { result } = renderHook(() => useSolvePlan(1), { wrapper: makeWrapper() })

    await act(async () => {
      result.current.mutate()
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(fetch).toHaveBeenCalledWith('/api/plans/1/solve', expect.objectContaining({ method: 'POST' }))
    expect(result.current.data).toEqual(solveResult)
  })

  it('wirft JvmUnavailableError bei 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'JVM nicht gefunden' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useSolvePlan(1), { wrapper: makeWrapper() })

    await act(async () => {
      result.current.mutate()
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.error).toBeInstanceOf(JvmUnavailableError)
  })
})
