'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  console.log('ProtectedRoute: Render state:', { hasUser: !!user, loading, userId: user?.id })

  useEffect(() => {
    console.log('ProtectedRoute: useEffect triggered:', { hasUser: !!user, loading })
    
    // Only redirect if we're definitely not loading and definitely no user
    // Add a small delay to prevent race conditions
    if (!loading && !user) {
      console.log('ProtectedRoute: No user found, setting redirect timer')
      const timer = setTimeout(() => {
        // Double-check that we still don't have a user after a brief delay
        if (!user) {
          console.log('ProtectedRoute: Redirecting to signin - no user found after delay')
          router.push('/auth/signin')
        } else {
          console.log('ProtectedRoute: User found during delay, canceling redirect')
        }
      }, 200) // Increased delay to 200ms
      
      return () => {
        console.log('ProtectedRoute: Clearing redirect timer')
        clearTimeout(timer)
      }
    }
  }, [user, loading, router])

  // Show loading state
  if (loading) {
    console.log('ProtectedRoute: Showing loading state')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // If no user and not loading, show fallback but don't redirect immediately
  if (!user) {
    console.log('ProtectedRoute: No user, showing access denied')
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-600">Please sign in to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  console.log('ProtectedRoute: User authenticated, rendering children')
  return <>{children}</>
}