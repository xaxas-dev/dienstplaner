export type MatchStatus = 'exact' | 'fuzzy' | 'new' | 'unmatched'
export type CodeDefaultAction = 'absence' | 'shift' | 'springer' | 'ignore' | 'unmatched'
export type EntityDefaultAction = 'map' | 'create' | 'skip'

export interface MatchCandidate {
  id: number
  name: string
  score: number
}

export interface DepartmentMatch {
  raw: string
  match_status: MatchStatus
  matched_id: number | null
  candidates: MatchCandidate[]
  default_action: EntityDefaultAction
}

export interface DoctorMatch {
  raw: string
  match_status: MatchStatus
  matched_id: number | null
  candidates: MatchCandidate[]
  default_action: EntityDefaultAction
  parsed_name: string
  percentage: number | null
}

export interface CodeEntry {
  raw: string
  default_action: CodeDefaultAction
  absence_type: string | null
  shift_type_id: number | null
  shift_type_short_name: string | null
  department_id: number | null
  department_short_name: string | null
}

export interface ImportMonth {
  sheet_name: string
  year: number
  month: number
  valid_from: string
  valid_to: string
}

export interface ImportAnalysis {
  month: ImportMonth
  departments: DepartmentMatch[]
  doctors: DoctorMatch[]
  codes: CodeEntry[]
  warnings: string[]
}

// Resolutions sent to commit endpoint
export type EntityResolution =
  | { action: 'map'; id: number }
  | { action: 'create' }
  | { action: 'skip' }

export type CodeResolution =
  | { action: 'absence'; absence_type: string }
  | { action: 'shift'; shift_type_id: number }
  | { action: 'create_shift'; short_name: string; name: string }
  | { action: 'springer'; department_id: number }
  | { action: 'ignore' }

export interface CommitResolutions {
  target_plan:
    | { mode: 'new'; name: string; valid_from: string; valid_to: string }
    | { mode: 'existing'; plan_id: number }
  department_resolutions: Record<string, EntityResolution>
  doctor_resolutions: Record<string, EntityResolution & { percentage?: number }>
  code_resolutions: Record<string, CodeResolution>
}

export interface ImportResult {
  plan_id: number
  plan_name: string
  created_departments: number
  created_doctors: number
  created_employment_periods: number
  created_rotations: number
  created_absences: number
  created_shifts: number
  created_springer_assignments: number
  warnings: string[]
}
