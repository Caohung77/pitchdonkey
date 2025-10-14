'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Mail, 
  Eye, 
  MousePointer, 
  TrendingUp,
  Clock,
  Users,
  Zap
} from 'lucide-react'

interface RealtimeData {
  emailsSentToday: number
  emailsSentThisHour: number
  currentOpenRate: number
  currentClickRate: number
  activeCampaigns: number
  topPerformingCampaign: {
    id: string
    name: string
    openRate: number
  } | null
  recentActivity: Array<{
    type: string
    description: string
    timestamp: string
  }>
}

export function RealtimeMetrics() {
  const [data, setData] = useState<RealtimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    loadRealtimeData()
    
    // Update every 30 seconds
    const interval = setInterval(loadRealtimeData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadRealtimeData = async () => {
    try {
      const response = await fetch('/api/analytics/realtime')
      
      if (response.ok) {
        const realtimeData = await response.json()
        setData(realtimeData)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to load realtime data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'campaign_started':
        return <Zap className="h-4 w-4 text-green-500" />
      case 'email_sent':
        return <Mail className="h-4 w-4 text-blue-500" />
      case 'email_opened':
        return <Eye className="h-4 w-4 text-yellow-500" />
      case 'email_clicked':
        return <MousePointer className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getRelativeTime = (timestamp: string): string => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Live Activity</h3>
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold">Live Activity</h3>
          <div className="h-2 w-2 bg-gray-400 rounded-full" />
        </div>
        <p className="text-gray-500">Unable to load realtime data</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Live Activity</h3>
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Updated {getRelativeTime(lastUpdated.toISOString())}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        {/* Emails Sent Today */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(data.emailsSentToday)}
          </div>
          <div className="text-sm text-gray-600">Sent Today</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatNumber(data.emailsSentThisHour)} this hour
          </div>
        </div>

        {/* Current Open Rate */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-2">
            <Eye className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatPercentage(data.currentOpenRate)}
          </div>
          <div className="text-sm text-gray-600">Open Rate</div>
          <div className="text-xs text-gray-500 mt-1">Today's average</div>
        </div>

        {/* Current Click Rate */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-2">
            <MousePointer className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatPercentage(data.currentClickRate)}
          </div>
          <div className="text-sm text-gray-600">Click Rate</div>
          <div className="text-xs text-gray-500 mt-1">Today's average</div>
        </div>

        {/* Active Campaigns */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-2">
            <Users className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.activeCampaigns}
          </div>
          <div className="text-sm text-gray-600">Active Campaigns</div>
          <div className="text-xs text-gray-500 mt-1">Currently running</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Campaign */}
        <div>
          <h4 className="font-medium mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
            Top Performer
          </h4>
          
          {data.topPerformingCampaign ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-green-900">
                    {data.topPerformingCampaign.name}
                  </div>
                  <div className="text-sm text-green-700">
                    {formatPercentage(data.topPerformingCampaign.openRate)} open rate
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  Best
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              No active campaigns
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="font-medium mb-3 flex items-center">
            <Activity className="h-4 w-4 mr-2 text-blue-500" />
            Recent Activity
          </h4>
          
          <div className="space-y-3 max-h-32 overflow-y-auto">
            {data.recentActivity.length > 0 ? (
              data.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {activity.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-4">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}