import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from './lib/supabase'
import { clearUserCache } from './lib/data'
import { useAppStore } from './store/useAppStore'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Jars = lazy(() => import('./pages/Jars'))
const Investments = lazy(() => import('./pages/Investments'))
const Projects = lazy(() => import('./pages/Projects'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Notes = lazy(() => import('./pages/Notes'))
const Business = lazy(() => import('./pages/Business'))
const BusinessDetail = lazy(() => import('./pages/BusinessDetail'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))

function Spinner() {
  return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
}

function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="card p-8 max-w-lg">
        <h1 className="text-xl font-black mb-2">Supabase is not configured</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Set these two environment variables, then rebuild / redeploy:</p>
        <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded-lg overflow-x-auto">VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJ...</pre>
        <p className="text-xs text-slate-500 mt-3">Local: put them in <code>.env.local</code>. Netlify / Vercel: Site settings → Environment variables.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const theme = useAppStore((s) => s.theme)
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession((prev) => { if (prev?.user?.id !== s?.user?.id) { clearUserCache(); qc.clear() } return s })
    })
    return () => subscription.unsubscribe()
  }, [qc])

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])

  if (!supabaseConfigured) return <SetupNeeded />
  if (session === undefined) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950"><Spinner /></div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/*" element={session ? (
          <Layout>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="jars" element={<Jars />} />
                <Route path="investments" element={<Investments />} />
                <Route path="projects" element={<Projects />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="notes" element={<Notes />} />
                <Route path="business" element={<Business />} />
                <Route path="business/:id" element={<BusinessDetail />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        ) : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
