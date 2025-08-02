import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
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
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Auth error:', error)
      return {
        user: null,
        error: 'Authentication failed',
        status: 401
      }
    }
    
    if (!user) {
      return {
        user: null,
        error: 'Unauthorized',
        status: 401
      }
    }
    
    return {
      user,
      error: null,
      status: 200
    }
  } catch (error) {
    console.error('Authentication check failed:', error)
    return {
      user: null,
      error: 'Internal authentication error',
      status: 500
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
 */
export function withAuth<T = any>(
  handler: (request: NextRequest, user: User) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = await authenticateRequest(request)
    
    if (auth.error || !auth.user) {
      return createErrorResponse(auth.error || 'Unauthorized', auth.status)
    }
    
    try {
      return await handler(request, auth.user)
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