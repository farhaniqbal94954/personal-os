import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof schema>

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setError(null)
    setInfo(null)
    if (mode === 'signup') {
      const { data: res, error } = await supabase.auth.signUp({ ...data, options: { emailRedirectTo: window.location.origin } })
      if (error) setError(error.message)
      else if (!res.session) { setInfo('Account created. Check your email and click the confirmation link, then sign in here.'); setMode('signin') }
      // with email confirmation off, a session is returned and the app opens immediately
    } else {
      const { error } = await supabase.auth.signInWithPassword(data)
      if (error) setError(error.message === 'Email not confirmed' ? 'Please confirm your email first — check your inbox for the link from Supabase.' : error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-black text-3xl mx-auto mb-4 shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50">
            P
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Personal OS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your private financial control centre
          </p>
        </div>

        {/* Card */}
        <div className="card p-7 shadow-xl shadow-slate-200/60 dark:shadow-black/30">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-6">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1.5">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="label">Password</label>
              <input
                {...register('password')}
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {info && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-3" data-testid="login-info">
                {info}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-5">
            {mode === 'signin' ? 'First time here? ' : 'Already have an account? '}
            <button type="button" className="font-bold text-indigo-600 hover:underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-5">
          🔒 Private & secure — only you have access
        </p>
      </div>
    </div>
  )
}
