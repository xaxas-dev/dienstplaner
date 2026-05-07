import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { RuleOverride, RuleOverrideCreate, RuleOverrideUpdate, OverrideScope } from '@/lib/types'

export interface RuleOverrideFilters {
  scope?: OverrideScope
  doctor_id?: number
  rule_key?: string
  active_on_date?: string
}

export const ruleOverrideKeys = {
  all: ['ruleOverrides'] as const,
  list: (filters: RuleOverrideFilters) => ['ruleOverrides', filters] as const,
}

function buildQueryString(filters: RuleOverrideFilters): string {
  const params = new URLSearchParams()
  if (filters.scope) params.set('scope', filters.scope)
  if (filters.doctor_id != null) params.set('doctor_id', String(filters.doctor_id))
  if (filters.rule_key) params.set('rule_key', filters.rule_key)
  if (filters.active_on_date) params.set('active_on_date', filters.active_on_date)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useRuleOverrides(filters: RuleOverrideFilters = {}) {
  return useQuery({
    queryKey: ruleOverrideKeys.list(filters),
    queryFn: () =>
      apiGet<RuleOverride[]>(`/api/rule-overrides${buildQueryString(filters)}`),
  })
}

export function useCreateRuleOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RuleOverrideCreate) =>
      apiPost<RuleOverride>('/api/rule-overrides', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ruleOverrideKeys.all })
    },
  })
}

export function useUpdateRuleOverride(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RuleOverrideUpdate) =>
      apiPatch<RuleOverride>(`/api/rule-overrides/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ruleOverrideKeys.all })
    },
  })
}

export function useDeleteRuleOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/rule-overrides/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ruleOverrideKeys.all })
    },
  })
}
