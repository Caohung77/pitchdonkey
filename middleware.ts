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

  // Protected page routes that require authentication (exclude API routes)
  const protectedPageRoutes = ['/dashboard']

  const isProtectedPageRoute = protectedPageRoutes.some(route => pathname.startsWith(route))
  
  // Skip middleware auth for API routes - let them handle their own authentication
  if (pathname.startsWith('/api/')) {
    return response
  }
  
  if (isProtectedPageRoute) {
    try {
      // Create Supabase client for session verification
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Check for authentication via cookies for page routes
      let isAuthenticated = false

      // Check for Supabase session cookies (standard format)
      const authCookies = request.cookies.getAll()
        .filter(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'))
      
      if (authCookies.length > 0) {
        try {
          // Try to extract access token from the most recent auth cookie
          const authCookie = authCookies[0]
          let accessToken = null
          
          try {
            // Parse the cookie value which should be JSON
            const cookieData = JSON.parse(authCookie.value)
            accessToken = cookieData?.access_token || cookieData?.accessToken
          } catch (parseError) {
            // If JSON parsing fails, try to use the value directly
            console.warn('Cookie parsing failed, trying direct value:', parseError)
            accessToken = authCookie.value
          }
          
          if (accessToken) {
            const { data: { user }, error } = await supabase.auth.getUser(accessToken)
            isAuthenticated = !error && !!user
          }
        } catch (error) {
          console.warn('Session cookie validation failed:', error)
          isAuthenticated = false
        }
      }

      // Handle unauthenticated requests for page routes
      if (!isAuthenticated) {
        // Redirect to signin for page routes
        const url = request.nextUrl.clone()
        url.pathname = '/auth/signin'
        url.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(url)
      }

      // Add user info to request headers for downstream use (if needed)
      // Note: This is optional and should be used carefully
      return response

    } catch (error) {
      console.error('Middleware auth error:', error)
      
      // Redirect to error page for critical auth failures on page routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth/error'
      return NextResponse.redirect(url)
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