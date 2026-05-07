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
