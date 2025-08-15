import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// ============================================================================
// UNIFIED SUPABASE CLIENT - ONE SOLUTION FOR EVERYTHING
// ============================================================================

/**
 * Client-side Supabase client for browser/React components
 * Use this in: AuthProvider, React components, client-side code
 */
export function createClientSupabase() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Server-side Supabase client for API routes and server components
 * Use this in: API routes, server components, middleware
 */
export async function createServerSupabase() {
  // Dynamic import to avoid "next/headers" error in client components
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore cookie setting errors in server components
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore cookie removal errors in server components
          }
        },
      },
    }
  )
}

// ============================================================================
// UNIFIED AUTHENTICATION HELPERS
// ============================================================================

/**
 * Get current user from server-side (API routes)
 */
export async function getServerUser() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Server auth error:', error)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
}

/**
 * Get current session from server-side (API routes)
 */
export async function getServerSession() {
  try {
    const supabase = await createServerSupabase()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Server session error:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

/**
 * Require authentication in API routes
 * Throws error if user is not authenticated
 */
export async function requireServerAuth() {
  const user = await getServerUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// For existing code that uses these names
export const supabase = createClientSupabase()
export const createClient = createClientSupabase

// Note: createServerSupabaseClient is now async, so existing code needs to be updated
export async function createServerSupabaseClient() {
  return await createServerSupabase()
}