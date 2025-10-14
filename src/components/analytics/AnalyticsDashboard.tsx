'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  Eye, 
  MousePointer, 
  Reply,
  AlertTriangle,
  Download,
  Calendar,
  Filter
} from 'lucide-react'
import { MetricsCard } from './MetricsCard'
import { PerformanceChart } from './PerformanceChart'
import { CampaignComparison } from './CampaignComparison'
import { RealtimeMetrics } from './RealtimeMetrics'
import { EngagementHeatmap } from './EngagementHeatmap'

interface AnalyticsDashboardProps {
  userId: string
  dateRange?: {
    startDate: string
    endDate: string
  }
}

interface DashboardMetrics {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  deliveryRate: number
  openRate: number
  clickRate: number
  replyRate: number
  trend: {
    sent: number
    opened: number
    clicked: number
    replied: number
  }
}

interface CampaignSummary {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  sent: number
  openRate: number
  clickRate: number
  replyRate: number
  lastActivity: string
}

export function AnalyticsDashboard({ userId, dateRange }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [userId, timeRange, dateRange])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Calculate date range
      const endDate = dateRange?.endDate || new Date().toISOString()
      const startDate = dateRange?.startDate || getStartDate(timeRange)

      // Load dashboard metrics
      const [metricsResponse, campaignsResponse] = await Promise.all([
        fetch(`/api/analytics/dashboard/metrics?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/analytics/campaigns/summary?startDate=${startDate}&endDate=${endDate}`)
      ])

      if (!metricsResponse.ok || !campaignsResponse.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const metricsData = await metricsResponse.json()
      const campaignsData = await campaignsResponse.json()

      setMetrics(metricsData)
      setCampaigns(campaignsData.campaigns || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getStartDate = (range: string): string => {
    const now = new Date()
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const handleExportReport = async () => {
    try {
      const startDate = dateRange?.startDate || getStartDate(timeRange)
      const endDate = dateRange?.endDate || new Date().toISOString()

      const response = await fetch('/api/analytics/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'overview',
          dateRange: { startDate, endDate },
          format: 'pdf',
          includeCharts: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to export report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report')
    }
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <div className="h-4 w-4" />
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <div className="flex items-center space-x-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Overview of your email campaign performance
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <RealtimeMetrics />

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Emails Sent"
            value={formatNumber(metrics.totalSent)}
            change={metrics.trend.sent}
            icon={<Mail className="h-5 w-5" />}
            trend={getTrendIcon(metrics.trend.sent)}
          />
          
          <MetricsCard
            title="Open Rate"
            value={formatPercentage(metrics.openRate)}
            change={metrics.trend.opened}
            icon={<Eye className="h-5 w-5" />}
            trend={getTrendIcon(metrics.trend.opened)}
          />
          
          <MetricsCard
            title="Click Rate"
            value={formatPercentage(metrics.clickRate)}
            change={metrics.trend.clicked}
            icon={<MousePointer className="h-5 w-5" />}
            trend={getTrendIcon(metrics.trend.clicked)}
          />
          
          <MetricsCard
            title="Reply Rate"
            value={formatPercentage(metrics.replyRate)}
            change={metrics.trend.replied}
            icon={<Reply className="h-5 w-5" />}
            trend={getTrendIcon(metrics.trend.replied)}
          />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trends */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Performance Trends</h3>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
          <PerformanceChart 
            dateRange={{
              startDate: dateRange?.startDate || getStartDate(timeRange),
              endDate: dateRange?.endDate || new Date().toISOString()
            }}
            metrics={['openRate', 'clickRate', 'replyRate']}
          />
        </Card>

        {/* Engagement Heatmap */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Engagement Heatmap</h3>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              View Calendar
            </Button>
          </div>
          <EngagementHeatmap 
            dateRange={{
              startDate: dateRange?.startDate || getStartDate(timeRange),
              endDate: dateRange?.endDate || new Date().toISOString()
            }}
          />
        </Card>
      </div>

      {/* Campaign Comparison */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Campaign Performance</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Compare Selected
            </Button>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </div>
        
        <CampaignComparison 
          campaigns={campaigns}
          selectedCampaigns={selectedCampaigns}
          onSelectionChange={setSelectedCampaigns}
        />
      </Card>

      {/* Campaign List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Campaigns</h3>
          <Button variant="outline" size="sm">
            View All Campaigns
          </Button>
        </div>
        
        <div className="space-y-4">
          {campaigns.slice(0, 5).map((campaign) => (
            <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div>
                  <h4 className="font-medium">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">
                    {formatNumber(campaign.sent)} sent • Last activity {new Date(campaign.lastActivity).toLocaleDateString()}
                  </p>
                </div>
                <Badge 
                  variant={
                    campaign.status === 'active' ? 'default' :
                    campaign.status === 'completed' ? 'secondary' :
                    campaign.status === 'paused' ? 'outline' : 'secondary'
                  }
                >
                  {campaign.status}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="font-medium">{formatPercentage(campaign.openRate)}</div>
                  <div className="text-gray-500">Open Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{formatPercentage(campaign.clickRate)}</div>
                  <div className="text-gray-500">Click Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{formatPercentage(campaign.replyRate)}</div>
                  <div className="text-gray-500">Reply Rate</div>
                </div>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}