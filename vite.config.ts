import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Works with ANY of these variable names — so connecting Supabase in Vercel (integration) is enough:
 *   VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 * Only the URL and the PUBLIC key are put into the browser bundle. Secret / service-role keys are never read.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // all vars (incl. Vercel's), used only here at build time
  const pick = (...names: string[]) => names.map((n) => env[n]).find((v) => v && v.trim())?.trim() || ''
  const url = pick('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SUPABASE_URL')
  const key = pick(
    'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
    'SUPABASE_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )
  // safety net: refuse to ship a secret key to the browser
  const isSecret = key.startsWith('sb_secret_') || (() => { try { return JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64').toString()).role === 'service_role' } catch { return false } })()
  if (isSecret) throw new Error('The Supabase key found is a SECRET / service_role key. Use the anon / publishable key instead.')
  if (mode === 'production' && (!url || !key)) console.warn('\n⚠️  Supabase URL / public key not found — the app will show a setup screen. Connect Supabase to this Vercel project and redeploy.\n')

  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      __SUPABASE_ANON_KEY__: JSON.stringify(key),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'charts-vendor': ['recharts'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'store-vendor': ['zustand'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
