import { createMiddlewareSupabaseClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next()
    const supabase = createMiddlewareSupabaseClient(request, response)

    // Refresh session if expired - required for Server Components
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Log middleware activity for debugging
    console.log('Middleware:', {
      path: request.nextUrl.pathname,
      hasSession: !!session,
      sessionError: sessionError?.message,
      userAgent: request.headers.get('user-agent')?.includes('Mozilla') ? 'browser' : 'other'
    })

    // Protected routes that require authentication
    const protectedPaths = ['/dashboard']
    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )

    // Auth routes that should redirect if already authenticated
    const authPaths = ['/auth/signin', '/auth/signup']
    const isAuthPath = authPaths.includes(request.nextUrl.pathname)

    // Only redirect if we're sure there's no session and no session error
    if (isProtectedPath && !session && !sessionError) {
      console.log('Middleware: Redirecting to signin - no session found')
      const redirectUrl = new URL('/auth/signin', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // If there's a session error, let the request through and let the client handle it
    if (isProtectedPath && sessionError) {
      console.log('Middleware: Session error, letting request through:', sessionError.message)
    }

    if (isAuthPath && session) {
      // Redirect to dashboard if already authenticated and trying to access auth pages
      console.log('Middleware: Redirecting to dashboard - already authenticated')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // Always let the request through if there's an error
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}