import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
    }),
    { name: 'dp-app-settings' }
  )
)
