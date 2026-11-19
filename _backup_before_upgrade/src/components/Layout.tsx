import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'

const NAV = [
  {
    section: 'WORKSPACE',
    items: [
      { to: '/',             label: 'Dashboard',        icon: '⊞' },
      { to: '/accounts',    label: 'Bank Accounts',    icon: '🏦' },
      { to: '/transactions',label: 'Transactions',     icon: '↕' },
      { to: '/investments', label: 'Investments',      icon: '📈' },
      { to: '/projects',    label: 'Projects & Budgets',icon: '📋' },
    ],
  },
  {
    section: 'PERSONAL',
    items: [
      { to: '/tasks',    label: 'Tasks',    icon: '✓' },
      { to: '/reminders',label: 'Reminders',icon: '🔔' },
      { to: '/notes',    label: 'Notes',    icon: '📝' },
    ],
  },
  {
    section: 'BUSINESS',
    items: [
      { to: '/business', label: 'Business Hub', icon: '🏢' },
    ],
  },
  {
    section: 'INSIGHTS',
    items: [
      { to: '/reports', label: 'Reports', icon: '📊' },
    ],
  },
]

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const { country, setCountry, theme, toggleTheme } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const Sidebar = (
    <aside className="flex flex-col h-full w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/80">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-black text-lg select-none shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
          P
        </div>
        <div>
          <div className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">Personal OS</div>
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control centre</div>
        </div>
      </div>

      {/* Country toggle */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(['UAE', 'INDIA'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCountry(c)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                country === c
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {c === 'UAE' ? '🇦🇪 UAE' : '🇮🇳 India'}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-1">
            <p className="px-3 pt-3 pb-1.5 text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase select-none">
              {section}
            </p>
            {items.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                <span className="text-base w-5 text-center">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1 shrink-0">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="text-base w-5 text-center">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <span className="text-base w-5 text-center">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60">
        {Sidebar}
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
            {Sidebar}
          </div>
        </>
      )}

      {/* Content area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 px-5 py-3 flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            className="lg:hidden btn btn-sm p-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {country === 'UAE' ? '🇦🇪 UAE · AED' : '🇮🇳 India · INR'}
            </span>
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-sm select-none">
              F
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-5 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
