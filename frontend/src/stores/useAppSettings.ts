import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AbsenceType } from '@/lib/types'

export const DEFAULT_ABSENCE_COLORS: Record<AbsenceType, string> = {
  URLAUB:           '#BBF7D0',
  KRANKHEIT:        '#FCA5A5',
  FORTBILDUNG:      '#C4B5FD',
  ELTERNZEIT:       '#BAE6FD',
  MUTTERSCHUTZ:     '#FBCFE8',
  SONSTIGES:        '#E5E7EB',
  EINARBEITUNG:     '#FDE68A',
  EINARBEITUNG_INA: '#FCD34D',
  UNBESETZT:        '#D1D5DB',
}

export const DEFAULT_SPRINGER_COLOR = '#d1fae5'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
  absenceColors: Record<AbsenceType, string>
  setAbsenceColor: (type: AbsenceType, color: string) => void
  springerColor: string
  setSpringerColor: (color: string) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      solverEnabled: true,
      setSolverEnabled: (solverEnabled) => set({ solverEnabled }),
      absenceColors: { ...DEFAULT_ABSENCE_COLORS },
      setAbsenceColor: (type, color) =>
        set((s) => ({ absenceColors: { ...s.absenceColors, [type]: color } })),
      springerColor: DEFAULT_SPRINGER_COLOR,
      setSpringerColor: (springerColor) => set({ springerColor }),
    }),
    {
      name: 'dp-app-settings',
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppSettings>),
        absenceColors: {
          ...DEFAULT_ABSENCE_COLORS,
          ...((persisted as Partial<AppSettings>)?.absenceColors ?? {}),
        },
      }),
    }
  )
)
