'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  BarChart3
} from 'lucide-react'

interface ProgressInsightsProps {
  analytics: {
    campaign: {
      status: string
    }
    overview: {
      totalEmails: number
      sentEmails: number
      deliveredEmails: number
      openedEmails: number
      clickedEmails: number
      repliedEmails: number
      bouncedEmails: number
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
  }
}

export function ProgressInsights({ analytics }: ProgressInsightsProps) {
  const { overview, dailyStats, campaign } = analytics

  // Calculate progress metrics
  const completionRate = overview.totalEmails > 0 ? Math.round((overview.sentEmails / overview.totalEmails) * 100) : 0
  const remainingEmails = Math.max(0, overview.totalEmails - overview.sentEmails)
  
  // Calculate recent activity trends
  const recentDays = dailyStats.slice(-7).filter(day => day.sent > 0)
  const hasRecentActivity = recentDays.length > 0
  
  // Performance benchmarks (industry averages)
  const benchmarks = {
    deliveryRate: 95,
    openRate: 20,
    clickRate: 3,
    replyRate: 1,
    bounceRate: 2
  }

  // Generate insights based on performance
  const insights = []

  // Completion insights
  if (campaign.status === 'sending' || campaign.status === 'running') {
    if (completionRate > 0 && completionRate < 100) {
      const estimatedTimeRemaining = remainingEmails > 0 ? Math.round((remainingEmails * 45) / 60) : 0 // 45 seconds per email
      insights.push({
        type: 'progress',
        icon: Clock,
        title: 'Campaign Progress',
        description: `${completionRate}% complete - ${remainingEmails} emails remaining`,
        detail: estimatedTimeRemaining > 0 ? `Estimated ${estimatedTimeRemaining} minutes remaining` : '',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      })
    }
  } else if (campaign.status === 'completed') {
    insights.push({
      type: 'success',
      icon: CheckCircle,
      title: 'Campaign Completed',
      description: `Successfully processed ${overview.sentEmails.toLocaleString()} emails`,
      detail: `${overview.repliedEmails} replies received (${overview.replyRate}% reply rate)`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    })
  }

  // Performance insights
  if (overview.deliveryRate >= benchmarks.deliveryRate) {
    insights.push({
      type: 'success',
      icon: CheckCircle,
      title: 'Excellent Delivery Rate',
      description: `${overview.deliveryRate}% delivery rate exceeds industry average`,
      detail: 'Your sender reputation and email authentication are working well',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    })
  } else if (overview.deliveryRate < 90 && overview.sentEmails > 10) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Low Delivery Rate',
      description: `${overview.deliveryRate}% delivery rate is below average (${benchmarks.deliveryRate}%)`,
      detail: 'Consider checking your sender reputation and email authentication settings',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    })
  }

  if (overview.openRate >= benchmarks.openRate && overview.deliveredEmails > 0) {
    insights.push({
      type: 'success',
      icon: TrendingUp,
      title: 'Strong Open Rate',
      description: `${overview.openRate}% open rate is above industry average (${benchmarks.openRate}%)`,
      detail: 'Your subject lines are effectively capturing attention',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    })
  } else if (overview.openRate < 15 && overview.deliveredEmails >= 20) {
    insights.push({
      type: 'improvement',
      icon: Lightbulb,
      title: 'Improve Subject Lines',
      description: `${overview.openRate}% open rate is below average (${benchmarks.openRate}%)`,
      detail: 'Try A/B testing different subject lines or sending at optimal times',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    })
  }

  if (overview.replyRate >= benchmarks.replyRate && overview.sentEmails >= 50) {
    insights.push({
      type: 'success',
      icon: Target,
      title: 'Outstanding Reply Rate',
      description: `${overview.replyRate}% reply rate exceeds expectations`,
      detail: 'Your email content is highly engaging and relevant to recipients',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    })
  }

  if (overview.bounceRate > benchmarks.bounceRate && overview.sentEmails >= 20) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'High Bounce Rate',
      description: `${overview.bounceRate}% bounce rate is above ideal threshold (${benchmarks.bounceRate}%)`,
      detail: 'Consider cleaning your email list and validating email addresses',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    })
  }

  // Activity insights
  if (hasRecentActivity) {
    const totalRecentActivity = recentDays.reduce((sum, day) => sum + day.sent + day.opened + day.clicked + day.replied, 0)
    if (totalRecentActivity > 0) {
      insights.push({
        type: 'activity',
        icon: BarChart3,
        title: 'Recent Activity',
        description: `Active sending in the last ${recentDays.length} days`,
        detail: `${recentDays.reduce((sum, day) => sum + day.sent, 0)} emails sent, ${recentDays.reduce((sum, day) => sum + day.opened, 0)} opens`,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      })
    }
  }

  // Optimization suggestions
  if (overview.sentEmails >= 50) {
    if (overview.clickRate < benchmarks.clickRate && overview.openRate >= benchmarks.openRate) {
      insights.push({
        type: 'improvement',
        icon: Zap,
        title: 'Optimize Call-to-Action',
        description: `${overview.clickRate}% click rate could be improved`,
        detail: 'Consider making your call-to-action buttons more prominent and compelling',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      })
    }

    if (overview.openRate >= 25 && overview.replyRate < 2) {
      insights.push({
        type: 'improvement',
        icon: Lightbulb,
        title: 'Enhance Email Content',
        description: 'Good open rate but low reply rate suggests content could be more engaging',
        detail: 'Try personalizing your message or including more specific value propositions',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      })
    }
  }

  // If no specific insights, provide general performance summary
  if (insights.length === 0 && overview.sentEmails > 0) {
    insights.push({
      type: 'info',
      icon: BarChart3,
      title: 'Campaign Performance',
      description: `${overview.sentEmails} emails sent with ${overview.deliveryRate}% delivery rate`,
      detail: `${overview.openedEmails} opens and ${overview.repliedEmails} replies received`,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lightbulb className="h-5 w-5" />
          <span>AI-Powered Insights</span>
        </CardTitle>
        <CardDescription>
          Automated analysis and recommendations for your campaign
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight, index) => {
              const IconComponent = insight.icon
              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${insight.bgColor} ${insight.borderColor}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 ${insight.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium ${insight.color} mb-1`}>
                        {insight.title}
                      </h4>
                      <p className="text-sm text-gray-700 mb-1">
                        {insight.description}
                      </p>
                      {insight.detail && (
                        <p className="text-xs text-gray-600">
                          {insight.detail}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${insight.bgColor} ${insight.color} border-0`}
                    >
                      {insight.type}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No insights available yet
            </h3>
            <p className="text-gray-600">
              Send more emails to get AI-powered performance insights and recommendations
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}