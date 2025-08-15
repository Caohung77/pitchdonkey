'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClientSupabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  plan: string
  subscriptionStatus: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  // Use Supabase client
  const supabase = createClientSupabase()

  // Create fallback user data from Supabase session
  const createFallbackUser = useCallback((supabaseUser: SupabaseUser): User => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.full_name || 
            supabaseUser.user_metadata?.name || 
            supabaseUser.email?.split('@')[0] || 
            'User',
      plan: supabaseUser.user_metadata?.plan || 'starter',
      subscriptionStatus: 'active'
    }
  }, [])

  // REMOVED: fetchEnhancedProfile function that was causing 401 authentication loops
  // The AuthProvider now only uses Supabase session data to prevent API calls that could fail
  // and trigger unwanted sign-outs. This was the root cause of the authentication loop issue.

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      console.log('AuthProvider: Initializing authentication...')
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('AuthProvider: Session error:', sessionError)
        setError('Session error: ' + sessionError.message)
        setUser(null)
        setLoading(false)
        return
      }

      if (!session?.user) {
        console.log('AuthProvider: No session found')
        setUser(null)
        setLoading(false)
        setError(null)
        return
      }

      console.log('AuthProvider: Session found for user:', session.user.email)
      
      // Set user from Supabase session data only - no API calls
      const fallbackUser = createFallbackUser(session.user)
      setUser(fallbackUser)
      setLoading(false)
      setError(null)
      
      console.log('AuthProvider: User set from session data, no API calls made')

    } catch (error) {
      console.error('AuthProvider: Error initializing auth:', error)
      setError('Failed to initialize authentication')
      setUser(null)
      setLoading(false)
    }
  }, [createFallbackUser])

  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event)
        
        if (event === 'SIGNED_IN' && session?.user) {
          const fallbackUser = createFallbackUser(session.user)
          setUser(fallbackUser)
          setLoading(false)
          setError(null)
          console.log('AuthProvider: User signed in, using session data only')
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          setError(null)
          console.log('AuthProvider: User signed out')
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Update user data on token refresh
          const fallbackUser = createFallbackUser(session.user)
          setUser(fallbackUser)
          console.log('AuthProvider: Token refreshed, user data updated')
        }
      }
    )

    // Initialize auth state
    initializeAuth()

    return () => {
      console.log('AuthProvider: Cleaning up auth state listener')
      subscription.unsubscribe()
    }
  }, [initializeAuth, createFallbackUser])

  // Refresh user profile - simplified to avoid API calls that could cause 401 loops
  const refreshUser = useCallback(async () => {
    if (!user) return
    
    try {
      // Get fresh session data from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const refreshedUser = createFallbackUser(session.user)
        setUser(refreshedUser)
        console.log('AuthProvider: User refreshed from session data')
      }
    } catch (error) {
      console.error('AuthProvider: Error refreshing user:', error)
    }
  }, [user, createFallbackUser])

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

  const signOut = useCallback(async () => {
    try {
      console.log('AuthProvider: Signing out...')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('AuthProvider: Sign out error:', error)
        setError('Failed to sign out')
        throw new Error(error.message)
      } else {
        setUser(null)
        setError(null)
        console.log('AuthProvider: Sign out successful')
        router.push('/auth/signin')
      }
    } catch (error) {
      console.error('AuthProvider: Sign out error:', error)
      setError('Failed to sign out')
      throw error
    }
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signUp, signOut, refreshUser }}>
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