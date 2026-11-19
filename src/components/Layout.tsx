import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearUserCache, useData } from '../lib/data'
import { useAppStore, useToast } from '../store/useAppStore'
import { FormHost } from './FormModal'
import { daysUntil } from '../lib/formatters'

const NAV = [
  { section: 'WORKSPACE', items: [
    { to: '/', label: 'Dashboard', icon: '⊞' }, { to: '/accounts', label: 'Bank Accounts', icon: '🏦' }, { to: '/transactions', label: 'Transactions', icon: '↕' },
    { to: '/budgets', label: 'Budgets', icon: '🎯' }, { to: '/investments', label: 'Investments', icon: '📈' }, { to: '/projects', label: 'Projects', icon: '📋' }] },
  { section: 'PERSONAL', items: [{ to: '/tasks', label: 'Tasks', icon: '✓', badge: 'tasks' }, { to: '/reminders', label: 'Reminders', icon: '🔔', badge: 'reminders' }, { to: '/notes', label: 'Notes', icon: '📝' }] },
  { section: 'BUSINESS', items: [{ to: '/business', label: 'Business Hub', icon: '🏢' }] },
  { section: 'INSIGHTS', items: [{ to: '/reports', label: 'Reports', icon: '📊' }, { to: '/settings', label: 'Settings', icon: '⚙️' }] },
]

function Toaster() {
  const { msg, kind } = useToast()
  if (!msg) return null
  return <div data-testid="toast" className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold max-w-[90vw] ${kind === 'err' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>{msg}</div>
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { country, setCountry, theme, toggleTheme } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data, isLoading, error, refetch } = useData()

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])

  async function signOut() { await supabase.auth.signOut(); clearUserCache(); navigate('/login') }

  const counts: Record<string, number> = data ? {
    tasks: data.tasks.filter((t) => !t.done && daysUntil(t.due_date) < 0).length,
    reminders: data.reminders.filter((r) => r.country === country && r.status !== 'Done' && daysUntil(r.due_date) < 0).length,
  } : {}

  const Sidebar = (
    <aside className="flex flex-col h-full w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/80">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-black text-lg select-none shadow-md">P</div>
        <div><div className="text-base font-black tracking-tight leading-tight">Personal OS</div><div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Control centre</div></div>
      </div>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(['UAE', 'INDIA'] as const).map((c) => (
            <button key={c} data-testid={`ws-${c}`} onClick={() => setCountry(c)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${country === c ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>{c === 'UAE' ? '🇦🇪 UAE' : '🇮🇳 India'}</button>
          ))}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-1">
            <p className="px-3 pt-3 pb-1.5 text-[9px] font-black tracking-widest text-slate-400 uppercase select-none">{section}</p>
            {items.map(({ to, label, icon, badge }: { to: string; label: string; icon: string; badge?: string }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl mb-0.5 text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                <span className="text-base w-5 text-center">{icon}</span><span className="flex-1">{label}</span>
                {badge && counts[badge] ? <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-1.5">{counts[badge]}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1 shrink-0">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">{theme === 'dark' ? '☀️' : '🌙'} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
        <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">↩ <span>Sign out</span></button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60">{Sidebar}</div>
      {mobileOpen && <><div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} /><div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">{Sidebar}</div></>}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 px-5 py-3 flex items-center gap-4 print:hidden">
          <button className="lg:hidden btn btn-sm p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
          <div className="flex-1" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{country === 'UAE' ? '🇦🇪 UAE · AED' : '🇮🇳 India · INR'}</span>
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-sm select-none">F</div>
        </header>
        <main className="flex-1 p-4 sm:p-5 lg:p-8 max-w-[1500px] w-full mx-auto">
          {isLoading ? <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            : error ? (
              <div className="card p-6 max-w-2xl mx-auto mt-10" data-testid="load-error">
                <h2 className="font-black text-lg mb-2 text-red-600">Could not load your data</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 break-words">{error.message}</p>
                <p className="text-xs text-slate-500 mb-4">Most common fix: in Supabase → SQL Editor, run <code>supabase/migrations/001_initial_schema.sql</code> (new project only) and then <code>002_upgrade.sql</code>.</p>
                <button className="btn-primary" onClick={() => refetch()}>Try again</button>
              </div>
            ) : children}
        </main>
      </div>
      <FormHost />
      <Toaster />
    </div>
  )
}
