'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, AlertCircle } from 'lucide-react'

interface ContactStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  by_status: Record<string, number>
  by_tags: Record<string, number>
}

interface ContactsStatsProps {
  userId: string
}

export function ContactsStats({ userId }: ContactsStatsProps) {
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [userId])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('ContactsStats: Fetching stats...')
      const response = await fetch('/api/contacts/stats')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`)
      }

      const data = await response.json()
      console.log('ContactsStats: Received data:', data)

      if (data.success && data.data) {
        setStats(data.data)
      } else {
        throw new Error(data.error || 'Failed to load stats')
      }

    } catch (error) {
      console.error('ContactsStats: Error fetching stats:', error)
      setError(error instanceof Error ? error.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Failed to load statistics: {error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No stats
  if (!stats) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Users className="h-4 w-4 mr-1" />
            Total Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <UserCheck className="h-4 w-4 mr-1" />
            Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <UserX className="h-4 w-4 mr-1" />
            Unsubscribed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.unsubscribed}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            Bounced
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.bounced}</div>
        </CardContent>
      </Card>
    </div>
  )
}