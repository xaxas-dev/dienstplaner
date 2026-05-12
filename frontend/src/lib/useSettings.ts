import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from './api'

export interface AppSettingResponse {
  key: string
  value: string
  description: string | null
  updated_at: string
}

export function useSetting(key: string) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: () => apiGet<AppSettingResponse>(`/api/settings/${key}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useClinicName() {
  return useSetting('clinic_name')
}

export function useUpdateSetting(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: string) =>
      apiPatch<AppSettingResponse>(`/api/settings/${key}`, { value }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings', key], data)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<AppSettingResponse[]>('/api/settings'),
    staleTime: 5 * 60 * 1000,
  })
}
