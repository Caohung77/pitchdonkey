'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  plan: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('AuthProvider: Initializing...')
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthProvider: Initial session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        error: error?.message
      })
      
      if (session?.user) {
        setUserFromSupabaseUser(session.user)
      } else {
        console.log('AuthProvider: No initial session found')
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthProvider: Auth state change:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id
      })
      
      if (session?.user) {
        console.log('AuthProvider: Setting user from session')
        setUserFromSupabaseUser(session.user)
      } else {
        console.log('AuthProvider: No session/user, clearing user state')
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const setUserFromSupabaseUser = async (supabaseUser: SupabaseUser) => {
    // Create fallback user data immediately
    const fallbackUser = {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      plan: 'starter'
    }

    // Set fallback user immediately to ensure authentication works
    setUser(fallbackUser)

    // Try to get enhanced user profile from our API in the background
    // But don't let API failures affect the authentication state
    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          // Update with enhanced profile data
          setUser({
            id: result.data.id,
            email: result.data.email,
            name: result.data.name || fallbackUser.name,
            plan: result.data.plan || 'starter'
          })
        }
      } else {
        console.warn('User profile API returned:', response.status, 'but keeping fallback user')
      }
    } catch (error) {
      console.warn('Error fetching enhanced user profile (keeping fallback):', error)
      // Keep the fallback user - don't clear the user state
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        }
      }
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}