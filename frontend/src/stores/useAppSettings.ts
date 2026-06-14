import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AbsenceType } from '@/lib/types'

export const DEFAULT_ABSENCE_COLORS: Record<AbsenceType, string> = {
  URLAUB:       '#BBF7D0',
  KRANKHEIT:    '#FCA5A5',
  FORTBILDUNG:  '#C4B5FD',
  ELTERNZEIT:   '#BAE6FD',
  MUTTERSCHUTZ: '#FBCFE8',
  SONSTIGES:    '#E5E7EB',
}

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
  absenceColors: Record<AbsenceType, string>
  setAbsenceColor: (type: AbsenceType, color: string) => void
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
    }),
    { name: 'dp-app-settings' }
  )
)
