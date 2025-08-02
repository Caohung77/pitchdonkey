'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useEffect, useState } from 'react'

export default function AuthDebug() {
  const { user, loading } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we can access the user profile API
        const response = await fetch('/api/user/profile')
        const data = await response.json()
        
        setDebugInfo({
          user,
          loading,
          apiResponse: data,
          apiStatus: response.status,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        setDebugInfo({
          user,
          loading,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }
    }

    checkAuth()
  }, [user, loading])

  if (!debugInfo) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Auth Debug Info</h3>
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  )
}