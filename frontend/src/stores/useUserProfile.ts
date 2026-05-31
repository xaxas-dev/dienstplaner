import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserProfile {
  name: string
  title: string
  note: string
  setProfile: (partial: Partial<{ name: string; title: string; note: string }>) => void
}

export const useUserProfile = create<UserProfile>()(
  persist(
    (set) => ({
      name: 'Planer',
      title: '',
      note: '',
      setProfile: (partial) => set((state) => ({ ...state, ...partial })),
    }),
    { name: 'dp-user-profile' }
  )
)
