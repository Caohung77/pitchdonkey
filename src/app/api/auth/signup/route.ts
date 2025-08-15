import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, upsertUserProfile } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        }
      }
    })

    if (error) {
      console.error('Supabase signup error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 400 }
      )
    }

    // Create user profile in our users table
    try {
      await upsertUserProfile({
        id: data.user.id,
        email: data.user.email!,
        name: name || data.user.email?.split('@')[0],
        avatar_url: data.user.user_metadata?.avatar_url
      })
    } catch (profileError) {
      console.error('Error creating user profile:', profileError)
      // Continue anyway - profile creation is not critical for signup
    }

    // Check if email confirmation is required
    if (!data.session && data.user && !data.user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: 'Please check your email to confirm your account',
        requiresConfirmation: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name || data.user.email?.split('@')[0],
          plan: 'starter'
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: name || data.user.email?.split('@')[0],
        plan: 'starter' // Default plan for new users
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}