'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  BarChart3,
  Settings,
  Plus,
  Activity,
  Zap,
  Target
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  emailsSent: number
  emailsDelivered: number
  emailsOpened: number
  emailsClicked: number
  emailsReplied: number
  contactsTotal: number
  campaignsActive: number
  campaignsCompleted: number
  deliveryRate: number
  openRate: number
  clickRate: number
  replyRate: number
}

interface AccountHealth {
  emailAccounts: {
    id: string
    email: string
    status: 'healthy' | 'warning' | 'error'
    warmupStatus: 'completed' | 'in_progress' | 'pending'
    dailySent: number
    dailyLimit: number
    reputation: number
  }[]
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical'
  issues: string[]
  recommendations: string[]
}

interface RecentActivity {
  id: string
  type: 'campaign_started' | 'email_sent' | 'reply_received' | 'contact_added' | 'account_connected'
  title: string
  description: string
  timestamp: string
  status?: 'success' | 'warning' | 'error'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [accountHealth, setAccountHealth] = useState<AccountHealth | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch dashboard stats
      const statsResponse = await fetch('/api/dashboard/stats')
      const statsData = await statsResponse.json()
      setStats(statsData)

      // Fetch account health
      const healthResponse = await fetch('/api/dashboard/health')
      const healthData = await healthResponse.json()
      setAccountHealth(healthData)

      // Fetch recent activity
      const activityResponse = await fetch('/api/dashboard/activity')
      const activityData = await activityResponse.json()
      setRecentActivity(activityData)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800'
      case 'good': return 'bg-blue-100 text-blue-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'campaign_started': return <Zap className="h-4 w-4" />
      case 'email_sent': return <Mail className="h-4 w-4" />
      case 'reply_received': return <TrendingUp className="h-4 w-4" />
      case 'contact_added': return <Users className="h-4 w-4" />
      case 'account_connected': return <CheckCircle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your campaigns.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/campaigns/new">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.emailsSent?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.deliveryRate ? `${stats.deliveryRate}% delivered` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.emailsOpened?.toLocaleString() || 0} opens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.replyRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.emailsReplied?.toLocaleString() || 0} replies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.campaignsActive || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.campaignsCompleted || 0} completed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Account Health */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Account Health
            </CardTitle>
            <CardDescription>
              Monitor your email accounts and sender reputation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Health Status */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`h-3 w-3 rounded-full ${
                  accountHealth?.overallHealth === 'excellent' ? 'bg-green-500' :
                  accountHealth?.overallHealth === 'good' ? 'bg-blue-500' :
                  accountHealth?.overallHealth === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <div>
                  <p className="font-medium">Overall Health</p>
                  <p className="text-sm text-muted-foreground">
                    {accountHealth?.overallHealth || 'Unknown'}
                  </p>
                </div>
              </div>
              <Badge className={getHealthBadgeColor(accountHealth?.overallHealth || '')}>
                {accountHealth?.overallHealth || 'Unknown'}
              </Badge>
            </div>

            {/* Email Accounts */}
            <div className="space-y-3">
              <h4 className="font-medium">Email Accounts</h4>
              {accountHealth?.emailAccounts?.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`h-2 w-2 rounded-full ${
                      account.status === 'healthy' ? 'bg-green-500' :
                      account.status === 'warning' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{account.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.dailySent}/{account.dailyLimit} daily emails
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {account.warmupStatus}
                    </Badge>
                    <span className="text-sm font-medium">{account.reputation}%</span>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No email accounts connected</p>
                  <Button asChild className="mt-2" size="sm">
                    <Link href="/dashboard/email-accounts">
                      Connect Account
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Issues and Recommendations */}
            {accountHealth?.issues && accountHealth.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Issues
                </h4>
                {accountHealth.issues.map((issue, index) => (
                  <p key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {issue}
                  </p>
                ))}
              </div>
            )}

            {accountHealth?.recommendations && accountHealth.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-blue-600">Recommendations</h4>
                {accountHealth.recommendations.map((rec, index) => (
                  <p key={index} className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    {rec}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates from your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {activity.status && (
                      <Badge 
                        variant={activity.status === 'success' ? 'default' : 
                                activity.status === 'warning' ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {activity.status}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Get started with common tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/campaigns/new">
                <Plus className="h-6 w-6 mb-2" />
                Create Campaign
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/contacts">
                <Users className="h-6 w-6 mb-2" />
                Manage Contacts
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/email-accounts">
                <Mail className="h-6 w-6 mb-2" />
                Email Accounts
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/analytics">
                <BarChart3 className="h-6 w-6 mb-2" />
                View Analytics
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}