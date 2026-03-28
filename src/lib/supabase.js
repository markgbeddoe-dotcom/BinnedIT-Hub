import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set — app will not connect to database')
}

// Use placeholder values when env vars are missing to prevent createClient from throwing
// The app will still render using fallback hardcoded data (D.* from financials.js)
const resolvedUrl = supabaseUrl || 'https://placeholder.supabase.co'
const resolvedKey = supabaseAnonKey || 'placeholder-anon-key'

export const supabase = createClient(resolvedUrl, resolvedKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
