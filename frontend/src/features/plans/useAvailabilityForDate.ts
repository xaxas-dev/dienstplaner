import { useQueries } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { availabilityKeys } from './useDoctorAvailability'
import type { INAAvailability } from '@/lib/types'

/**
 * Loads INA availability for multiple doctors on a single date.
 * Returns a doctor-id-keyed dict: { [doctorId]: INAAvailability }.
 * Disabled when date is empty or doctorIds is empty.
 */
export function useAvailabilityForDate(
  doctorIds: number[],
  date: string,
): Record<number, INAAvailability> {
  const results = useQueries({
    queries: doctorIds.map((id) => ({
      queryKey: availabilityKeys.byDoctorRange(id, date, date),
      queryFn: () =>
        apiGet<INAAvailability[]>(
          `/api/doctors/${id}/ina-availability?from=${date}&to=${date}`,
        ),
      enabled: doctorIds.length > 0 && date.length > 0,
    })),
  })

  const map: Record<number, INAAvailability> = {}
  results.forEach((result, idx) => {
    const entry = result.data?.[0]
    if (entry) {
      map[doctorIds[idx]] = entry
    }
  })
  return map
}
