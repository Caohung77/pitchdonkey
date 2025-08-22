import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const response = NextResponse.next()

  // Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Skip authentication for public routes
  const publicRoutes = [
    '/',
    '/auth',
    '/api/health',
    '/api/auth',
    '/_next',
    '/favicon.ico'
  ]

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  if (isPublicRoute) {
    return response
  }

  // Protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/api/email-accounts',
    '/api/campaigns',
    '/api/contacts',
    '/api/ai',
    '/api/user'
  ]

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    try {
      // Create Supabase client for session verification
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Check for authentication in different ways
      let isAuthenticated = false

      // Method 1: Check Authorization header for API routes
      if (pathname.startsWith('/api/')) {
        const authHeader = request.headers.get('authorization')
        
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          const { data: { user }, error } = await supabase.auth.getUser(token)
          isAuthenticated = !error && !!user
        }
      }

      // Method 2: Check cookies for page routes (dashboard)
      if (!isAuthenticated && pathname.startsWith('/dashboard')) {
        // Check for session in cookies
        const sessionCookie = request.cookies.get('supabase-auth-token')
        
        if (sessionCookie) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser(sessionCookie.value)
            isAuthenticated = !error && !!user
          } catch {
            // Invalid session cookie
            isAuthenticated = false
          }
        }
      }

      // Handle unauthenticated requests
      if (!isAuthenticated) {
        if (pathname.startsWith('/api/')) {
          // Return 401 for API routes
          return NextResponse.json(
            { error: 'Authentication required', code: 'UNAUTHORIZED' },
            { status: 401 }
          )
        } else {
          // Redirect to signin for page routes
          const url = request.nextUrl.clone()
          url.pathname = '/auth/signin'
          url.searchParams.set('redirectTo', pathname)
          return NextResponse.redirect(url)
        }
      }

      // Add user info to request headers for downstream use (if needed)
      // Note: This is optional and should be used carefully
      return response

    } catch (error) {
      console.error('Middleware auth error:', error)
      
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication service unavailable', code: 'AUTH_ERROR' },
          { status: 503 }
        )
      } else {
        // Redirect to error page for critical auth failures
        const url = request.nextUrl.clone()
        url.pathname = '/auth/error'
        return NextResponse.redirect(url)
      }
    }
  }

  // Allow all other routes (static assets, etc.)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}