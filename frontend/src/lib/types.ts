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
export type PlanUpdate = components['schemas']['PlanUpdate']
export type PlanWithRelations = components['schemas']['PlanWithRelations']
export type PlanStatus = components['schemas']['PlanStatus']
export type ShiftWithDetails = components['schemas']['ShiftWithDetails']
export type ShiftUpdate = components['schemas']['ShiftUpdate']
export type PlanConflicts = components['schemas']['PlanConflicts']
export type ShiftConflict = components['schemas']['ShiftConflict']
export type ConflictType = components['schemas']['ConflictType']

export type RotationAssignment = components['schemas']['RotationAssignmentResponse']
export type RotationAssignmentWithDetails = components['schemas']['RotationAssignmentWithDetails']
export type RotationAssignmentCreate = components['schemas']['RotationAssignmentCreate']
export type RotationAssignmentUpdate = components['schemas']['RotationAssignmentUpdate']

export type AbsenceType = components['schemas']['AbsenceType']
export type Absence = components['schemas']['AbsenceResponse']
export type AbsenceCreate = components['schemas']['AbsenceCreate']
export type AbsenceUpdate = components['schemas']['AbsenceUpdate']

export type PlanTarifWarnings = components['schemas']['PlanTarifWarnings']
export type TarifWarning = components['schemas']['TarifWarning']
export type TarifSeverity = components['schemas']['TarifSeverity']

export type SolveResult = components['schemas']['SolveResult']
export type ProposedAssignment = components['schemas']['ProposedAssignment']
export type ApplyRequest = components['schemas']['ApplyRequest']
export type ApplyResult = components['schemas']['ApplyResult']

// Dashboard-Types (manuell, noch nicht im OpenAPI-Schema generiert)
export interface DoctorInfo {
  id: number
  name: string
  initials: string
}

export interface DutyShift {
  shift_type_name: string
  shift_type_short_name: string
  time_label: string | null
  doctors: DoctorInfo[]
}

export interface CoverageBar {
  department_name: string
  filled: number
  total: number
  pct: number
}

export type AttentionSeverity = 'info' | 'warning' | 'error'

export interface AttentionItem {
  date: string
  person_name: string | null
  message: string
  severity: AttentionSeverity
}

export interface DashboardKpis {
  coverage_pct: number
  open_shifts: number
  conflicts: number
  on_leave: number
}

export interface DashboardSummary {
  plan_id: number
  date: string
  kpis: DashboardKpis
  today_shifts: DutyShift[]
  coverage_by_department: CoverageBar[]
  attention: AttentionItem[]
}
