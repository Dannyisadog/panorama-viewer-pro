import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing environment variables.\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local\n' +
    'For Vercel: add them in Project Settings → Environment Variables'
  )
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)
