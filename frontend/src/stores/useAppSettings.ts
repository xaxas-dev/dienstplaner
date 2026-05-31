import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      solverEnabled: true,
      setSolverEnabled: (solverEnabled) => set({ solverEnabled }),
    }),
    { name: 'dp-app-settings' }
  )
)
