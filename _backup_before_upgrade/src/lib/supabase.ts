import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\nCopy .env.local.example to .env.local and fill in your Supabase URL and anon key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
