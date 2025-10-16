'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, XCircle, TrendingDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface BounceStatistics {
  total: number
  hard: number
  soft: number
  complaint: number
  byCategory: Record<string, number>
  recentBounces: Array<{
    contactEmail: string
    bounceType: string
    bounceCategory: string
    bouncedAt: string
    campaignName: string | null
  }>
}

interface BounceStatisticsProps {
  campaignId?: string
  dateFrom?: string
  showRecentBounces?: boolean
}

export function BounceStatistics({
  campaignId,
  dateFrom,
  showRecentBounces = true
}: BounceStatisticsProps) {
  const [stats, setStats] = useState<BounceStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBounceStats()
  }, [campaignId, dateFrom])

  const fetchBounceStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (campaignId) params.set('campaignId', campaignId)
      if (dateFrom) params.set('dateFrom', dateFrom)

      const response = await fetch(`/api/bounces/stats?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch bounce statistics')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Error fetching bounce stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load bounce statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bounce Statistics</CardTitle>
          <CardDescription>Email delivery failures and bounces</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bounce Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const bounceRate = stats.total > 0
    ? ((stats.hard + stats.soft + stats.complaint) / stats.total * 100).toFixed(1)
    : '0.0'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Bounce Statistics
        </CardTitle>
        <CardDescription>
          Email delivery failures and bounce tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Bounces */}
          <div className="flex flex-col space-y-2 p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Total Bounces</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">
              {bounceRate}% bounce rate
            </div>
          </div>

          {/* Hard Bounces */}
          <div className="flex flex-col space-y-2 p-4 border rounded-lg border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              <span>Hard Bounces</span>
            </div>
            <div className="text-2xl font-bold text-red-700">{stats.hard}</div>
            <div className="text-xs text-red-600">
              Permanent failures
            </div>
          </div>

          {/* Soft Bounces */}
          <div className="flex flex-col space-y-2 p-4 border rounded-lg border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Soft Bounces</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700">{stats.soft}</div>
            <div className="text-xs text-yellow-600">
              Temporary failures
            </div>
          </div>

          {/* Complaints */}
          <div className="flex flex-col space-y-2 p-4 border rounded-lg border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span>Complaints</span>
            </div>
            <div className="text-2xl font-bold text-orange-700">{stats.complaint}</div>
            <div className="text-xs text-orange-600">
              Spam reports
            </div>
          </div>
        </div>

        {/* Bounce Categories */}
        {Object.keys(stats.byCategory).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Bounce Categories</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory).map(([category, count]) => (
                <Badge key={category} variant="outline">
                  {category.replace(/_/g, ' ')}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent Bounces */}
        {showRecentBounces && stats.recentBounces.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Bounces</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.recentBounces.slice(0, 10).map((bounce, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {bounce.contactEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bounce.bounceCategory.replace(/_/g, ' ')}
                      {bounce.campaignName && ` • ${bounce.campaignName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={bounce.bounceType === 'hard' ? 'destructive' : 'secondary'}
                    >
                      {bounce.bounceType}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(bounce.bouncedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Bounces Message */}
        {stats.total === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No bounces detected</p>
            <p className="text-sm">Your email delivery is performing well!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
