import type { components } from './api-types'

export type Doctor = components['schemas']['DoctorWithRelations']
export type DoctorCreate = components['schemas']['DoctorCreate']
export type DoctorUpdate = components['schemas']['DoctorUpdate']
export type DoctorType = components['schemas']['DoctorType']

export type EmploymentPeriod = components['schemas']['EmploymentPeriodResponse']
export type EmploymentPeriodCreate = components['schemas']['EmploymentPeriodBody']
export type EmploymentPeriodUpdate = components['schemas']['EmploymentPeriodUpdate']

export type Qualification = components['schemas']['QualificationResponse']
export type QualificationCreate = components['schemas']['QualificationCreate']
export type QualificationUpdate = components['schemas']['QualificationUpdate']
export type DoctorQualification = components['schemas']['DoctorQualificationResponse']
export type DoctorQualificationBody = components['schemas']['DoctorQualificationBody']

export type Department = components['schemas']['DepartmentResponse']
export type DepartmentCreate = components['schemas']['DepartmentCreate']
export type DepartmentUpdate = components['schemas']['DepartmentUpdate']

export type ShiftType = components['schemas']['ShiftTypeResponse']
export type ShiftTypeCreate = components['schemas']['ShiftTypeCreate']
export type ShiftTypeUpdate = components['schemas']['ShiftTypeUpdate']

export type RuleOverride = components['schemas']['RuleOverrideResponse']
export type RuleOverrideCreate = components['schemas']['RuleOverrideCreate']
export type RuleOverrideUpdate = components['schemas']['RuleOverrideUpdate']
export type OverrideScope = components['schemas']['OverrideScope']

export type INAExclusionReason = 'SCHWANGERSCHAFT' | 'EINARBEITUNG' | 'SONSTIGES'

export interface INAExclusion {
  id: number
  doctor_id: number
  valid_from: string
  valid_to: string | null
  reason: INAExclusionReason
  notes: string | null
  created_at: string
  updated_at: string
}

export interface INAExclusionCreate {
  valid_from: string
  valid_to?: string | null
  reason: INAExclusionReason
  notes?: string | null
}

export interface INAExclusionUpdate {
  valid_from?: string
  valid_to?: string | null
  reason?: INAExclusionReason
  notes?: string | null
}

export interface INAAvailability {
  date: string
  available: boolean
  reasons: string[]
}

export type Plan = components['schemas']['PlanResponse']
export type PlanCreate = components['schemas']['PlanCreate']
export type PlanWithRelations = components['schemas']['PlanWithRelations']
export type PlanStatus = components['schemas']['PlanStatus']
export type ShiftWithDetails = components['schemas']['ShiftWithDetails']
export type ShiftUpdate = components['schemas']['ShiftUpdate']
export type PlanConflicts = components['schemas']['PlanConflicts']
export type ShiftConflict = components['schemas']['ShiftConflict']
export type ConflictType = components['schemas']['ConflictType']
