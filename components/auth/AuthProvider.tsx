'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
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

  // Fetch enhanced user profile from API with retry logic
  const fetchEnhancedProfile = useCallback(async (fallbackUser: User, retryCount = 0) => {
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
          console.log('AuthProvider: Enhanced profile fetched successfully')
          setUser({
            id: result.data.id,
            email: result.data.email,
            name: result.data.name || fallbackUser.name,
            plan: result.data.plan || 'starter',
            subscriptionStatus: result.data.subscriptionStatus || 'active'
          })
          setError(null)
        } else {
          console.log('AuthProvider: API returned fallback data, using it')
          setUser(result.data || fallbackUser)
          setError(null)
        }
      } else if (response.status === 401) {
        console.log('AuthProvider: Profile API returned 401, signing out')
        await signOut()
      } else {
        console.warn('AuthProvider: Profile API failed, keeping fallback user')
        // Keep the fallback user, don't break auth state
        setError(null)
      }
    } catch (error) {
      console.warn('AuthProvider: Profile fetch failed:', error)
      
      // Retry logic for network errors
      if (retryCount < 2) {
        console.log(`AuthProvider: Retrying profile fetch (attempt ${retryCount + 1})`)
        setTimeout(() => fetchEnhancedProfile(fallbackUser, retryCount + 1), 1000 * (retryCount + 1))
      } else {
        console.warn('AuthProvider: Max retries reached, keeping fallback user')
        setError(null)
      }
    }
  }, [])

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
      
      // Immediately set fallback user to prevent auth state gaps
      const fallbackUser = createFallbackUser(session.user)
      setUser(fallbackUser)
      setLoading(false)
      setError(null)

      // Fetch enhanced profile in background
      await fetchEnhancedProfile(fallbackUser)

    } catch (error) {
      console.error('AuthProvider: Error initializing auth:', error)
      setError('Failed to initialize authentication')
      setUser(null)
      setLoading(false)
    }
  }, [createFallbackUser, fetchEnhancedProfile])

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
          
          // Fetch enhanced profile in background
          await fetchEnhancedProfile(fallbackUser)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          setError(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Update user data on token refresh
          const fallbackUser = createFallbackUser(session.user)
          setUser(fallbackUser)
          await fetchEnhancedProfile(fallbackUser)
        }
      }
    )

    // Initialize auth state
    initializeAuth()

    return () => {
      console.log('AuthProvider: Cleaning up auth state listener')
      subscription.unsubscribe()
    }
  }, [initializeAuth, createFallbackUser, fetchEnhancedProfile])

  // Refresh user profile
  const refreshUser = useCallback(async () => {
    if (!user) return
    
    try {
      await fetchEnhancedProfile(user)
    } catch (error) {
      console.error('AuthProvider: Error refreshing user:', error)
    }
  }, [user, fetchEnhancedProfile])

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