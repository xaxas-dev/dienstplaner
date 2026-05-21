import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { INAAvailability } from '@/lib/types'

export const availabilityKeys = {
  byDoctorRange: (doctorId: number, from: string, to: string) =>
    ['availability', 'doctor', doctorId, from, to] as const,
}

/**
 * Loads INA availability for a doctor over a date range.
 * Returns a date-keyed dict for O(1) lookup in the grid.
 * Disabled when doctorId is null or from/to are missing.
 */
export function useDoctorAvailability(
  doctorId: number | null,
  from: string | null,
  to: string | null,
): { data: Record<string, INAAvailability> | undefined; isLoading: boolean } {
  const enabled = doctorId !== null && from !== null && to !== null

  const query = useQuery({
    queryKey: enabled
      ? availabilityKeys.byDoctorRange(doctorId!, from!, to!)
      : ['availability', 'disabled'],
    queryFn: () =>
      apiGet<INAAvailability[]>(
        `/api/doctors/${doctorId}/ina-availability?from=${from}&to=${to}`,
      ),
    enabled,
  })

  const data: Record<string, INAAvailability> | undefined =
    query.data
      ? Object.fromEntries(query.data.map((entry) => [entry.date, entry]))
      : undefined

  return { data, isLoading: query.isLoading }
}
