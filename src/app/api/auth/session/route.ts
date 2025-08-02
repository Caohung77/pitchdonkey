import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    return NextResponse.json({
      success: true,
      data: {
        hasSession: !!session,
        hasUser: !!user,
        sessionError: sessionError?.message,
        userError: userError?.message,
        userId: user?.id,
        userEmail: user?.email
      }
    })
  } catch (error) {
    console.error('Session check error:', error)
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