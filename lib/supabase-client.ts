import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Single Supabase client instance to prevent multiple instances
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

// Client-side Supabase client (for React components) - Returns singleton instance
export const createClientSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
    console.log('Supabase client instance created')
  } else {
    console.log('Returning existing Supabase client instance')
  }
  return supabaseInstance
}

// Export singleton instance for direct usage
export const supabase = createClientSupabase()