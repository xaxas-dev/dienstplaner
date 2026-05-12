/**
 * Dienstplaner — Mock data for UI development
 *
 * Drop at: frontend/src/lib/mock/dp-mock.ts
 *
 * Why a parallel "DP*" shape instead of the real `Doctor` / `ShiftType` types?
 * - The real types are generated from the backend OpenAPI and carry many
 *   fields we don't need yet. Until the new screens are wired to react-query,
 *   we use these flatter UI-shaped types so Claude Code can build everything
 *   without faking 30 fields.
 * - When wiring the real backend, write a small `toDPDoctor(d: Doctor)`
 *   adapter — don't change the UI types.
 */

import type { ShiftColorToken } from '@/lib/design/shift-palette'

export type DPDoctor = {
  id: number
  name: string                    // "Lena Hartmann"
  role: 'Facharzt' | 'WBA' | 'Assistenz' | 'Extern'
  wbjYear?: number                // Weiterbildungsjahr, only for WBA/Assistenz
  employmentPct: number           // 0..100
  active: boolean
  qualifications: string[]        // short codes like ['ITS', 'Stroke']
  onLeave?: { from: string; to: string; reason: string } | null
}

export type DPShiftType = {
  id: number
  code: string                    // "F", "S", "N", "BD", ...
  name: string                    // "Frühdienst"
  start: string                   // "07:00"
  end: string                     // "15:30"
  color: ShiftColorToken
  weekday: boolean
  weekend: boolean
}

export type DPAssignment = {
  doctorId: number
  date: string                    // ISO yyyy-mm-dd
  shiftTypeId: number
  conflict?: 'rule' | 'qual' | 'rest' | null
}

export type DPDepartment = {
  id: number
  name: string                    // "Stroke Unit"
  short: string                   // "SU"
  beds?: number
  coverage: number                // 0..1 for current week
}

/* ─── seed data ─────────────────────────────────────────────────────────── */

export const MOCK_SHIFT_TYPES: DPShiftType[] = [
  { id: 1, code: 'F',  name: 'Frühdienst',   start: '07:00', end: '15:30', color: 'peach', weekday: true,  weekend: true  },
  { id: 2, code: 'S',  name: 'Spätdienst',   start: '13:00', end: '21:00', color: 'sage',  weekday: true,  weekend: true  },
  { id: 3, code: 'N',  name: 'Nachtdienst',  start: '20:30', end: '07:30', color: 'plum',  weekday: true,  weekend: true  },
  { id: 4, code: 'BD', name: 'Bereitschaft', start: '16:00', end: '08:00', color: 'sky',   weekday: true,  weekend: true  },
  { id: 5, code: 'RD', name: 'Rufdienst',    start: '17:00', end: '07:00', color: 'rose',  weekday: true,  weekend: true  },
  { id: 6, code: 'U',  name: 'Urlaub',       start: '',      end: '',      color: 'sand',  weekday: true,  weekend: true  },
  { id: 7, code: 'FR', name: 'Frei',         start: '',      end: '',      color: 'grey',  weekday: true,  weekend: true  },
]

export const MOCK_DOCTORS: DPDoctor[] = [
  { id: 1, name: 'Lena Hartmann',  role: 'Facharzt',  employmentPct: 100, active: true, qualifications: ['ITS', 'Stroke', 'EEG'] },
  { id: 2, name: 'Jonas Krüger',   role: 'Facharzt',  employmentPct: 100, active: true, qualifications: ['Stroke', 'NCH-Kons'] },
  { id: 3, name: 'Mira Sahin',     role: 'WBA', wbjYear: 4, employmentPct: 100, active: true, qualifications: ['Stroke'] },
  { id: 4, name: 'David Brand',    role: 'WBA', wbjYear: 3, employmentPct: 100, active: true, qualifications: ['EEG'] },
  { id: 5, name: 'Aylin Yıldız',   role: 'Assistenz', wbjYear: 2, employmentPct: 80,  active: true, qualifications: [] },
  { id: 6, name: 'Paul Reichardt', role: 'Assistenz', wbjYear: 1, employmentPct: 100, active: true, qualifications: [] },
  { id: 7, name: 'Nora Engel',     role: 'Facharzt',  employmentPct: 75,  active: true, qualifications: ['ITS'], onLeave: { from: '2026-05-09', to: '2026-05-23', reason: 'Urlaub' } },
  { id: 8, name: 'Tom Vasiljevic', role: 'Extern',    employmentPct: 20,  active: true, qualifications: ['Rufdienst'] },
]

export const MOCK_DEPARTMENTS: DPDepartment[] = [
  { id: 1, name: 'Normalstation',  short: 'NS',  beds: 32, coverage: 0.95 },
  { id: 2, name: 'Stroke Unit',    short: 'SU',  beds: 8,  coverage: 1.0  },
  { id: 3, name: 'Intensiv',       short: 'ITS', beds: 6,  coverage: 0.83 },
  { id: 4, name: 'Ambulanz',       short: 'AMB',           coverage: 0.92 },
]

/**
 * Generate a deterministic 14-day plan starting from `start`.
 * Uses a tiny seeded RNG so screenshots are stable.
 */
export function buildMockAssignments(start: Date, days = 14): DPAssignment[] {
  const out: DPAssignment[] = []
  const codes = [1, 2, 3, 4, 7] // F S N BD FR
  let seed = 42
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (const doc of MOCK_DOCTORS) {
    if (!doc.active) continue
    for (let d = 0; d < days; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + d)
      const iso = date.toISOString().slice(0, 10)
      // honor onLeave
      if (doc.onLeave && iso >= doc.onLeave.from && iso <= doc.onLeave.to) {
        out.push({ doctorId: doc.id, date: iso, shiftTypeId: 6 })
        continue
      }
      if (rng() < 0.25) continue // day off, no assignment
      const shiftTypeId = codes[Math.floor(rng() * codes.length)]
      const conflict = rng() < 0.05 ? 'rule' : null
      out.push({ doctorId: doc.id, date: iso, shiftTypeId, conflict })
    }
  }
  return out
}

export const MOCK_COVERAGE_14D = [
  0.92, 0.95, 1.0, 0.88, 0.96, 0.78, 0.74,
  0.91, 0.93, 0.97, 1.0,  0.85, 0.79, 0.82,
]
