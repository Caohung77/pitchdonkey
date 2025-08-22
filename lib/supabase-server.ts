import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Server-side Supabase client for API routes - using service role for reliable access
export const createServerSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Get user from JWT token in Authorization header
export async function getUserFromRequest(request: Request): Promise<any> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.error('Error getting user from token:', error)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error in getUserFromRequest:', error)
    return null
  }
}

// Service role client for admin operations
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Helper function to get user from server (DEPRECATED - use auth-middleware.ts)
// @deprecated Use requireAuth from auth-middleware.ts instead
export async function getUser() {
  console.warn('getUser from supabase-server.ts is deprecated. Use requireAuth from auth-middleware.ts')
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

// Helper function to get session from server (DEPRECATED - use auth-middleware.ts)
// @deprecated Use requireAuth from auth-middleware.ts instead
export async function getSession() {
  console.warn('getSession from supabase-server.ts is deprecated. Use requireAuth from auth-middleware.ts')
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

// Helper function to require authentication (DEPRECATED - use auth-middleware.ts)
// @deprecated Use requireAuth from auth-middleware.ts instead
export async function requireAuth() {
  console.warn('requireAuth from supabase-server.ts is deprecated. Use requireAuth from auth-middleware.ts')
  const user = await getUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

// Helper function to get user profile
export async function getUserProfile(userId: string) {
  const supabase = await createServerSupabaseClient()
  
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
  const supabase = await createServerSupabaseClient()
  
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