import { createClient } from '@supabase/supabase-js'

// Filled in at build time by vite.config.ts from VITE_*, NEXT_PUBLIC_* or SUPABASE_* variables
// (so the Vercel ⇄ Supabase integration works without adding anything by hand).
const supabaseUrl = __SUPABASE_URL__
const supabaseAnonKey = __SUPABASE_ANON_KEY__

/** false when no URL / public key was found — App shows a setup screen instead of a blank page */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
)
