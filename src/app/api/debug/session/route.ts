import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get session and user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Get cookies
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    const supabaseCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || cookie.name.includes('sb-')
    )
    
    return NextResponse.json({
      success: true,
      data: {
        session: {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at,
          error: sessionError?.message
        },
        user: {
          exists: !!user,
          userId: user?.id,
          email: user?.email,
          error: userError?.message
        },
        cookies: {
          total: allCookies.length,
          supabase: supabaseCookies.length,
          supabaseCookieNames: supabaseCookies.map(c => c.name),
          allCookieNames: allCookies.map(c => c.name)
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Debug session error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}