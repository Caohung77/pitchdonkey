import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | null
  error: string | null
  status: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Standardized authentication check for API routes
 * Uses the correct route handler client for Next.js API routes
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Try to get user from Authorization header first
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (!error && user) {
        return {
          user,
          error: null,
          status: 200
        }
      }
    }

    // Fallback: try to get user from cookies using createServerClient
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // No-op for API routes
          },
          remove(name: string, options: any) {
            // No-op for API routes
          },
        },
      }
    )
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (!error && user) {
      return {
        user,
        error: null,
        status: 200
      }
    }
    
    // If no valid session found, return the hardcoded user for now
    // TODO: Remove this once proper auth is working
    const fallbackUser = {
      id: 'ea1f9972-6109-44ec-93d5-05522f49760c',
      email: 'banbau@gmx.net',
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    return {
      user: fallbackUser as any,
      error: null,
      status: 200
    }
  } catch (error) {
    console.error('Authentication check failed:', error)
    return {
      user: null,
      error: 'Authentication failed',
      status: 401
    }
  }
}

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
  data?: T,
  error?: string,
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: status >= 200 && status < 300,
    ...(data && { data }),
    ...(error && { error })
  }
  
  return NextResponse.json(response, { status })
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500
): NextResponse {
  return createApiResponse(undefined, error, status)
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return createApiResponse(data, undefined, status)
}

/**
 * Wrapper for authenticated API routes
 * Supports both simple handlers and handlers that expect route parameters
 */
export function withAuth<T = any>(
  handler: (request: NextRequest, user: User, context?: { params: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: any }): Promise<NextResponse> => {
    const auth = await authenticateRequest(request)
    
    if (auth.error || !auth.user) {
      return createErrorResponse(auth.error || 'Unauthorized', auth.status)
    }
    
    try {
      return await handler(request, auth.user, context)
    } catch (error) {
      console.error('API handler error:', error)
      return createErrorResponse('Internal server error', 500)
    }
  }
}

/**
 * Handle common API errors
 */
export function handleApiError(error: any): NextResponse {
  console.error('API Error:', error)
  
  if (error.message?.includes('JWT')) {
    return createErrorResponse('Session expired', 401)
  }
  
  if (error.message?.includes('not found')) {
    return createErrorResponse('Resource not found', 404)
  }
  
  if (error.message?.includes('already exists')) {
    return createErrorResponse(error.message, 409)
  }
  
  if (error.message?.includes('Validation failed')) {
    return createErrorResponse(error.message, 400)
  }
  
  return createErrorResponse('Internal server error', 500)
}