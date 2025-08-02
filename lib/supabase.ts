import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Server-side Supabase client for API routes
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Middleware Supabase client
export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}

// Service role client for admin operations
export const supabaseAdmin = createSupabaseClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Helper function to get user from server
export async function getUser() {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting user:', error)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error in getUser:', error)
    return null
  }
}

// Helper function to get session from server
export async function getSession() {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error in getSession:', error)
    return null
  }
}

// Helper function to require authentication
export async function requireAuth() {
  const user = await getUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

// Helper function to get user profile
export async function getUserProfile(userId: string) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.error('Error getting user profile:', error)
    return null
  }
  
  return data
}

// Helper function to create or update user profile
export async function upsertUserProfile(user: {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.email.split('@')[0],
      avatar_url: user.avatar_url,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error upserting user profile:', error)
    throw error
  }
  
  return data
}

// Export the main client for backward compatibility
export function createClient() {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)
}