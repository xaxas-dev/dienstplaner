import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Doctor, DoctorCreate, DoctorUpdate, EmploymentPeriodCreate, EmploymentPeriodUpdate, DoctorQualificationBody } from '@/lib/types'

export { useQualifications } from '@/features/qualifications/useQualifications'

// ── Query Keys ────────────────────────────────────────────────────────────────

export const doctorKeys = {
  all: ['doctors'] as const,
  list: (includeInactive: boolean) => ['doctors', { includeInactive }] as const,
  detail: (id: number) => ['doctor', id] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useDoctors(includeInactive = false) {
  return useQuery({
    queryKey: doctorKeys.list(includeInactive),
    queryFn: () => apiGet<Doctor[]>(`/api/doctors?include_inactive=${includeInactive}`),
  })
}

export function useDoctor(doctorId: number) {
  return useQuery({
    queryKey: doctorKeys.detail(doctorId),
    queryFn: () => apiGet<Doctor>(`/api/doctors/${doctorId}`),
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DoctorCreate) => apiPost<Doctor>('/api/doctors', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.all })
    },
  })
}

export function useUpdateDoctor(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DoctorUpdate) => apiPatch<Doctor>(`/api/doctors/${doctorId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.all })
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}

export function useDeleteDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (doctorId: number) => apiDelete(`/api/doctors/${doctorId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.all })
    },
  })
}

export function useCreateEmploymentPeriod(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EmploymentPeriodCreate) =>
      apiPost(`/api/doctors/${doctorId}/employment-periods`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}

export function useUpdateEmploymentPeriod(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ epId, data }: { epId: number; data: EmploymentPeriodUpdate }) =>
      apiPatch(`/api/employment-periods/${epId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}

export function useDeleteEmploymentPeriod(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (epId: number) => apiDelete(`/api/employment-periods/${epId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}

export function useAddQualification(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ qualificationId, body }: { qualificationId: number; body?: DoctorQualificationBody }) =>
      apiPost(`/api/doctors/${doctorId}/qualifications/${qualificationId}`, body ?? {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}

export function useRemoveQualification(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (qualificationId: number) =>
      apiDelete(`/api/doctors/${doctorId}/qualifications/${qualificationId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorKeys.detail(doctorId) })
    },
  })
}
