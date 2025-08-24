'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import { 
  ArrowLeft,
  Mail,
  Users,
  TrendingUp,
  Eye,
  MousePointer,
  Reply,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Activity,
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { EmailPipelineChart } from '@/components/analytics/EmailPipelineChart'
import { DeliveryRateChart } from '@/components/analytics/DeliveryRateChart'
import { EmailDetailsTable } from '@/components/analytics/EmailDetailsTable'
import { ProgressInsights } from '@/components/analytics/ProgressInsights'

interface CampaignAnalytics {
  campaign: {
    id: string
    name: string
    status: string
    createdAt: string
    startDate?: string
    endDate?: string
  }
  overview: {
    totalEmails: number
    sentEmails: number
    deliveredEmails: number
    openedEmails: number
    clickedEmails: number
    repliedEmails: number
    bouncedEmails: number
    complainedEmails: number
    deliveryRate: number
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number
    complaintRate: number
  }
  dailyStats: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    bounced: number
  }>
  topEmails: Array<{
    subject: string
    sent: number
    opened: number
    clicked: number
    replied: number
    openRate: number
    clickRate: number
    replyRate: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    recipient: string
    subject: string
    timestamp: string
    status: string
  }>
}

export default function CampaignAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const data = await ApiClient.get(`/api/campaigns/${campaignId}/analytics`)
      console.log('Analytics data:', data)
      
      if (data.success) {
        setAnalytics(data.data)
      } else {
        setError('Failed to load analytics data')
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error)
      setError(error.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (campaignId) {
      fetchAnalytics()
    }
  }, [campaignId])

  const handleExportData = async () => {
    try {
      // Create CSV data from analytics
      if (!analytics) return
      
      const csvData = [
        ['Metric', 'Value'],
        ['Campaign Name', analytics.campaign.name],
        ['Total Emails', analytics.overview.totalEmails],
        ['Sent Emails', analytics.overview.sentEmails],
        ['Delivered Emails', analytics.overview.deliveredEmails],
        ['Opened Emails', analytics.overview.openedEmails],
        ['Clicked Emails', analytics.overview.clickedEmails],
        ['Replied Emails', analytics.overview.repliedEmails],
        ['Bounced Emails', analytics.overview.bouncedEmails],
        ['Delivery Rate', `${analytics.overview.deliveryRate}%`],
        ['Open Rate', `${analytics.overview.openRate}%`],
        ['Click Rate', `${analytics.overview.clickRate}%`],
        ['Reply Rate', `${analytics.overview.replyRate}%`],
        ['Bounce Rate', `${analytics.overview.bounceRate}%`]
      ]
      
      const csvContent = csvData.map(row => row.join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `campaign-${analytics.campaign.name}-analytics.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting data:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading campaign analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Analytics</h3>
          <p className="text-gray-600 mb-4">{error || 'Unknown error occurred'}</p>
          <Button onClick={() => fetchAnalytics()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sending: { color: 'bg-blue-100 text-blue-800', icon: '📤' },
      running: { color: 'bg-green-100 text-green-800', icon: '🟢' },
      paused: { color: 'bg-yellow-100 text-yellow-800', icon: '⏸️' },
      completed: { color: 'bg-green-100 text-green-800', icon: '✅' },
      stopped: { color: 'bg-red-100 text-red-800', icon: '🛑' },
      draft: { color: 'bg-gray-100 text-gray-800', icon: '📝' },
      scheduled: { color: 'bg-purple-100 text-purple-800', icon: '📅' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return (
      <Badge className={config.color}>
        {config.icon} {status}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{analytics.campaign.name}</h1>
            <div className="flex items-center space-x-3 mt-1">
              {getStatusBadge(analytics.campaign.status)}
              <span className="text-sm text-gray-500">
                Created {formatDate(analytics.campaign.createdAt)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalEmails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.sentEmails} sent, {analytics.overview.totalEmails - analytics.overview.sentEmails} queued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.deliveredEmails} of {analytics.overview.sentEmails} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.openedEmails} opens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.replyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.repliedEmails} replies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization and Performance Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <EmailPipelineChart analytics={analytics} />
        <DeliveryRateChart dailyStats={analytics.dailyStats} />
      </div>

      {/* Progress Insights */}
      <ProgressInsights analytics={analytics} />

      {/* Detailed Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Email Performance Breakdown</CardTitle>
            <CardDescription>Detailed statistics for this campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Sent</p>
                  <div className="flex items-center space-x-2">
                    <div className="text-lg font-semibold">{analytics.overview.sentEmails}</div>
                    <Badge variant="secondary">{analytics.overview.sentEmails > 0 ? '100%' : '0%'}</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Delivered</p>
                  <div className="flex items-center space-x-2">
                    <div className="text-lg font-semibold">{analytics.overview.deliveredEmails}</div>
                    <Badge variant="secondary">{analytics.overview.deliveryRate}%</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Opened</p>
                  <div className="flex items-center space-x-2">
                    <div className="text-lg font-semibold">{analytics.overview.openedEmails}</div>
                    <Badge variant="secondary">{analytics.overview.openRate}%</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Clicked</p>
                  <div className="flex items-center space-x-2">
                    <div className="text-lg font-semibold">{analytics.overview.clickedEmails}</div>
                    <Badge variant="secondary">{analytics.overview.clickRate}%</Badge>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Replied</p>
                    <div className="flex items-center space-x-2">
                      <div className="text-lg font-semibold text-green-600">{analytics.overview.repliedEmails}</div>
                      <Badge className="bg-green-100 text-green-800">{analytics.overview.replyRate}%</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Bounced</p>
                    <div className="flex items-center space-x-2">
                      <div className="text-lg font-semibold text-red-600">{analytics.overview.bouncedEmails}</div>
                      <Badge className="bg-red-100 text-red-800">{analytics.overview.bounceRate}%</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Complaints</p>
                    <div className="flex items-center space-x-2">
                      <div className="text-lg font-semibold text-red-600">{analytics.overview.complainedEmails}</div>
                      <Badge className="bg-red-100 text-red-800">{analytics.overview.complaintRate}%</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest email interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentActivity.slice(0, 10).map((activity, index) => (
                <div key={activity.id || index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {activity.type === 'reply' && <Reply className="h-4 w-4 text-green-500" />}
                    {activity.type === 'click' && <MousePointer className="h-4 w-4 text-blue-500" />}
                    {activity.type === 'open' && <Eye className="h-4 w-4 text-yellow-500" />}
                    {activity.type === 'sent' && <Mail className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.recipient || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {activity.subject || 'No subject'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activity.timestamp ? formatDate(activity.timestamp) : 'Unknown time'}
                    </p>
                  </div>
                </div>
              ))}
              {analytics.recentActivity.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Details Table */}
      <EmailDetailsTable 
        campaignId={campaignId}
        analytics={analytics}
      />
    </div>
  )
}