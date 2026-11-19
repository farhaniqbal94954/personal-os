import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Country } from '../types/database'

interface AppState {
  country: Country
  theme: 'light' | 'dark'
  setCountry: (country: Country) => void
  toggleTheme: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      country: 'UAE',
      theme: 'light',
      setCountry: (country) => set({ country }),
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
    }),
    { name: 'personal-os-prefs' }
  )
)
