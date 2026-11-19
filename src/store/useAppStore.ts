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
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'personal-os-prefs' },
  ),
)

/* ---- toasts ---- */
interface ToastState { msg: string | null; kind: 'ok' | 'err'; show: (m: string, kind?: 'ok' | 'err') => void }
let timer: ReturnType<typeof setTimeout> | undefined
export const useToast = create<ToastState>((set) => ({
  msg: null, kind: 'ok',
  show: (msg, kind = 'ok') => { clearTimeout(timer); set({ msg, kind }); timer = setTimeout(() => set({ msg: null }), kind === 'err' ? 6000 : 2800) },
}))
export const toast = (m: string, kind: 'ok' | 'err' = 'ok') => useToast.getState().show(m, kind)
