import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/useAppStore'
import Layout from './components/Layout'
import Login from './pages/Login'

// Lazy-load pages for fast initial load
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Accounts     = lazy(() => import('./pages/Accounts'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Investments  = lazy(() => import('./pages/Investments'))
const Projects     = lazy(() => import('./pages/Projects'))
const Tasks        = lazy(() => import('./pages/Tasks'))
const Reminders    = lazy(() => import('./pages/Reminders'))
const Notes        = lazy(() => import('./pages/Notes'))
const Business     = lazy(() => import('./pages/Business'))
const BusinessDetail = lazy(() => import('./pages/BusinessDetail'))
const Reports      = lazy(() => import('./pages/Reports'))

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const { theme } = useAppStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route
          path="/*"
          element={
            session ? (
              <Layout>
                <Suspense fallback={<Spinner />}>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="transactions" element={<Transactions />} />
                    <Route path="investments" element={<Investments />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="reminders" element={<Reminders />} />
                    <Route path="notes" element={<Notes />} />
                    <Route path="business" element={<Business />} />
                    <Route path="business/:id" element={<BusinessDetail />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
