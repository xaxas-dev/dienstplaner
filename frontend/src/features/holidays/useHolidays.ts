import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import type { Holiday, HolidayCreate } from '@/lib/types'

export const holidayKeys = {
  byYear: (year: number) => ['holidays', year] as const,
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: holidayKeys.byYear(year),
    queryFn: () => apiGet<Holiday[]>(`/api/holidays?year=${year}`),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HolidayCreate) => apiPost<Holiday>('/api/holidays', data),
    onSuccess: (_data, variables) => {
      const year = new Date(variables.date).getFullYear()
      void qc.invalidateQueries({ queryKey: holidayKeys.byYear(year) })
    },
  })
}

export function useDeleteHoliday(year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (holidayDate: string) => apiDelete(`/api/holidays/${holidayDate}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: holidayKeys.byYear(year) })
    },
  })
}

export function useSeedHolidays() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (year: number) =>
      apiPost<{ added: number; year: number }>('/api/holidays/seed', { year }),
    onSuccess: (_data, year) => {
      void qc.invalidateQueries({ queryKey: holidayKeys.byYear(year) })
    },
  })
}
