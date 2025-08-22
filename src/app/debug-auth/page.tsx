'use client'

import { useEffect, useState } from 'react'
import { createClientSupabase } from '@/lib/supabase-client'
import { useAuth } from '@/components/auth/AuthProvider'

export default function DebugAuthPage() {
  const { user, loading, error } = useAuth()
  const [supabaseSession, setSupabaseSession] = useState<any>(null)
  const [supabaseUser, setSupabaseUser] = useState<any>(null)
  const [supabaseError, setSupabaseError] = useState<any>(null)

  useEffect(() => {
    const supabase = createClientSupabase()
    
    // Get session directly from Supabase
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSupabaseSession(session)
      setSupabaseError(error)
    })

    // Get user directly from Supabase
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      setSupabaseUser(user)
      if (error) setSupabaseError(error)
    })
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-3">AuthProvider State</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Loading:</strong> {loading ? 'true' : 'false'}</div>
            <div><strong>Error:</strong> {error || 'none'}</div>
            <div><strong>User:</strong></div>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-3">Direct Supabase</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Session:</strong></div>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(supabaseSession, null, 2)}
            </pre>
            <div><strong>User:</strong></div>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(supabaseUser, null, 2)}
            </pre>
            <div><strong>Error:</strong></div>
            <pre className="bg-red-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(supabaseError, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button 
          onClick={() => window.location.href = '/auth/signin'}
          className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
        >
          Go to Sign In
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}