import type { components } from './api-types'

export type Doctor = components['schemas']['DoctorWithRelations']
export type DoctorCreate = components['schemas']['DoctorCreate']
export type DoctorUpdate = components['schemas']['DoctorUpdate']
export type DoctorType = components['schemas']['DoctorType']

export type EmploymentPeriod = components['schemas']['EmploymentPeriodResponse']
export type EmploymentPeriodCreate = components['schemas']['EmploymentPeriodBody']
export type EmploymentPeriodUpdate = components['schemas']['EmploymentPeriodUpdate']

export type Qualification = components['schemas']['QualificationResponse']
export type DoctorQualification = components['schemas']['DoctorQualificationResponse']
export type DoctorQualificationBody = components['schemas']['DoctorQualificationBody']
