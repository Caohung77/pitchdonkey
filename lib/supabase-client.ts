import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client-side Supabase client (for React components)
export const createClientSupabase = () => createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
)

// Browser client for direct usage
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Legacy export for backward compatibility
export const createBrowserClient = () => createClient<Database>(supabaseUrl, supabaseAnonKey)