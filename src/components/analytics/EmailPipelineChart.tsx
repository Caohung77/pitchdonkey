'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Mail, 
  CheckCircle, 
  Eye, 
  MousePointer, 
  Reply, 
  AlertTriangle,
  ArrowRight,
  Users
} from 'lucide-react'

interface EmailPipelineChartProps {
  analytics: {
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
    }
  }
}

export function EmailPipelineChart({ analytics }: EmailPipelineChartProps) {
  const { overview } = analytics

  // Calculate stage-by-stage conversion rates
  const stages = [
    {
      name: 'Total Contacts',
      count: overview.totalEmails,
      percentage: 100,
      icon: Users,
      color: 'bg-gray-100 text-gray-800',
      description: 'Recipients in campaign'
    },
    {
      name: 'Emails Sent',
      count: overview.sentEmails,
      percentage: overview.totalEmails > 0 ? Math.round((overview.sentEmails / overview.totalEmails) * 100) : 0,
      icon: Mail,
      color: 'bg-blue-100 text-blue-800',
      description: 'Successfully dispatched'
    },
    {
      name: 'Delivered',
      count: overview.deliveredEmails,
      percentage: overview.deliveryRate,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      description: 'Reached recipient inbox'
    },
    {
      name: 'Opened',
      count: overview.openedEmails,
      percentage: overview.openRate,
      icon: Eye,
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Email was opened'
    },
    {
      name: 'Clicked',
      count: overview.clickedEmails,
      percentage: overview.clickRate,
      icon: MousePointer,
      color: 'bg-purple-100 text-purple-800',
      description: 'Link clicked'
    },
    {
      name: 'Replied',
      count: overview.repliedEmails,
      percentage: overview.replyRate,
      icon: Reply,
      color: 'bg-emerald-100 text-emerald-800',
      description: 'Recipient responded'
    }
  ]

  // Calculate drop-off at each stage
  const getDropOffRate = (currentIndex: number) => {
    if (currentIndex === 0) return 0
    const previous = stages[currentIndex - 1]
    const current = stages[currentIndex]
    if (previous.count === 0) return 0
    return Math.round(((previous.count - current.count) / previous.count) * 100)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Mail className="h-5 w-5" />
          <span>Email Pipeline</span>
        </CardTitle>
        <CardDescription>
          Track emails through each stage of the outreach process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline Visualization */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const dropOffRate = getDropOffRate(index)
            const IconComponent = stage.icon
            
            return (
              <div key={stage.name} className="space-y-2">
                {/* Stage Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${stage.color}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{stage.name}</h4>
                      <p className="text-xs text-gray-500">{stage.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{stage.count.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{stage.percentage}%</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="ml-11">
                  <Progress 
                    value={stage.percentage} 
                    className="h-2"
                    indicatorClassName="bg-blue-500"
                  />
                </div>

                {/* Drop-off indicator */}
                {index < stages.length - 1 && dropOffRate > 0 && (
                  <div className="ml-11 flex items-center space-x-2 text-xs text-gray-500">
                    <ArrowRight className="h-3 w-3" />
                    <span>{dropOffRate}% drop-off to next stage</span>
                  </div>
                )}

                {/* Divider */}
                {index < stages.length - 1 && (
                  <div className="border-l-2 border-dashed border-gray-200 ml-6 h-4" />
                )}
              </div>
            )
          })}
        </div>

        {/* Summary Stats */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Overall Conversion</p>
              <p className="text-xs text-gray-600">
                From sent to reply: {overview.sentEmails > 0 ? Math.round((overview.repliedEmails / overview.sentEmails) * 100) : 0}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Engagement Rate</p>
              <p className="text-xs text-gray-600">
                From delivered to opened: {overview.openRate}%
              </p>
            </div>
          </div>
          
          {/* Issue Indicators */}
          {overview.bounceRate > 5 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm font-medium text-red-700">High Bounce Rate</p>
              </div>
              <p className="text-xs text-red-600 mt-1">
                {overview.bounceRate}% bounce rate detected. Consider reviewing your email list quality.
              </p>
            </div>
          )}
          
          {overview.deliveryRate < 90 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <p className="text-sm font-medium text-yellow-700">Low Delivery Rate</p>
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                {overview.deliveryRate}% delivery rate. Check your sender reputation and email authentication.
              </p>
            </div>
          )}
          
          {overview.openRate < 15 && overview.deliveredEmails > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-medium text-blue-700">Low Open Rate</p>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {overview.openRate}% open rate. Consider testing different subject lines or send times.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}