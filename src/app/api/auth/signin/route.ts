import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { security } from '@/lib/security'

// Demo users for testing
const DEMO_USERS = [
  {
    id: 'demo-user-1',
    email: 'demo@coldreachpro.com',
    password: 'Demo123!@#',
    name: 'Demo User',
    plan: 'professional'
  },
  {
    id: 'admin-user',
    email: 'admin@coldreachpro.com', 
    password: 'Admin123!@#',
    name: 'Admin User',
    plan: 'agency'
  }
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    const validation = security.validate.validateBody(body, security.schemas.login)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid email or password format' },
        { status: 400 }
      )
    }

    // Find user (in a real app, this would query the database)
    const user = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password (in a real app, you'd use bcrypt)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session token (simplified for demo)
    const sessionToken = security.encrypt.generateToken(32)
    
    // Set session cookie
    const cookieStore = cookies()
    cookieStore.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // Set user info cookie (for client-side access)
    cookieStore.set('user-info', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      }
    })

  } catch (error) {
    console.error('Signin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}