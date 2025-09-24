'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  Mail,
  MousePointer,
  Reply,
  Eye,
  AlertTriangle,
  Calendar,
  RefreshCw,
  BarChart3,
  Activity,
  CheckCircle,
  XCircle
} from 'lucide-react'
import {
  getEngagementStatusInfo,
  getEngagementScoreColor,
  calculateEngagementScoreBreakdown,
  type EngagementScoreBreakdown
} from '@/lib/contact-engagement'

interface Contact {
  id: string
  email: string
  engagement_status?: string
  engagement_score?: number
  engagement_sent_count?: number
  engagement_open_count?: number
  engagement_click_count?: number
  engagement_reply_count?: number
  engagement_bounce_count?: number
  engagement_last_positive_at?: string
}

interface ContactEngagementTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

interface EmailActivity {
  id: string
  sent_at: string
  opened_at?: string
  clicked_at?: string
  replied_at?: string
  bounced_at?: string
  status: string
  subject?: string
  campaign_name?: string
}

export function EngagementTab({ contact, onContactUpdate }: ContactEngagementTabProps) {
  const [emailActivity, setEmailActivity] = useState<EmailActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [scoreBreakdown, setScoreBreakdown] = useState<EngagementScoreBreakdown | null>(null)

  const engagementStatus = getEngagementStatusInfo(contact.engagement_status as any)
  const scoreColors = getEngagementScoreColor(contact.engagement_score || 0)

  useEffect(() => {
    // Calculate score breakdown
    const breakdown = calculateEngagementScoreBreakdown(
      contact.engagement_open_count || 0,
      contact.engagement_click_count || 0,
      contact.engagement_reply_count || 0,
      contact.engagement_last_positive_at || null
    )
    setScoreBreakdown(breakdown)

    // TODO: Fetch email activity from API
    fetchEmailActivity()
  }, [contact])

  const fetchEmailActivity = async () => {
    setLoading(true)
    try {
      // TODO: Implement API call to fetch email tracking data
      // Placeholder data for now
      const mockActivity: EmailActivity[] = [
        {
          id: '1',
          sent_at: '2024-01-15T10:00:00Z',
          opened_at: '2024-01-15T10:15:00Z',
          clicked_at: '2024-01-15T10:20:00Z',
          status: 'clicked',
          subject: 'Introduction to our platform',
          campaign_name: 'Welcome Series'
        },
        {
          id: '2',
          sent_at: '2024-01-10T14:00:00Z',
          opened_at: '2024-01-10T14:30:00Z',
          status: 'opened',
          subject: 'Follow-up on your interest',
          campaign_name: 'Follow-up Campaign'
        },
        {
          id: '3',
          sent_at: '2024-01-05T09:00:00Z',
          status: 'sent',
          subject: 'Welcome to PitchDonkey',
          campaign_name: 'Welcome Series'
        }
      ]
      setEmailActivity(mockActivity)
    } catch (error) {
      console.error('Failed to fetch email activity:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculateEngagement = async () => {
    // TODO: Implement engagement recalculation API call
    console.log('Recalculating engagement for contact:', contact.id)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActivityIcon = (activity: EmailActivity) => {
    if (activity.bounced_at) return <XCircle className="h-4 w-4 text-red-500" />
    if (activity.replied_at) return <Reply className="h-4 w-4 text-purple-500" />
    if (activity.clicked_at) return <MousePointer className="h-4 w-4 text-blue-500" />
    if (activity.opened_at) return <Eye className="h-4 w-4 text-green-500" />
    return <Mail className="h-4 w-4 text-gray-500" />
  }

  const getActivityStatus = (activity: EmailActivity) => {
    if (activity.bounced_at) return { label: 'Bounced', color: 'bg-red-100 text-red-800' }
    if (activity.replied_at) return { label: 'Replied', color: 'bg-purple-100 text-purple-800' }
    if (activity.clicked_at) return { label: 'Clicked', color: 'bg-blue-100 text-blue-800' }
    if (activity.opened_at) return { label: 'Opened', color: 'bg-green-100 text-green-800' }
    return { label: 'Sent', color: 'bg-gray-100 text-gray-800' }
  }

  return (
    <div className="space-y-6">
      {/* Engagement Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Engagement Overview</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateEngagement}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status and Score */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge className={`${engagementStatus.bgColor} ${engagementStatus.color} border-0 text-sm`}>
                {engagementStatus.label}
              </Badge>
              <div className="text-sm text-gray-600">{engagementStatus.description}</div>
            </div>

            <div className="text-right">
              <div className={`text-2xl font-bold ${scoreColors.color}`}>
                {contact.engagement_score || 0}
              </div>
              <div className="text-sm text-gray-600">Engagement Score</div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {contact.engagement_sent_count || 0}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center space-x-1">
                <Mail className="h-4 w-4" />
                <span>Emails Sent</span>
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {contact.engagement_open_count || 0}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center space-x-1">
                <Eye className="h-4 w-4" />
                <span>Opens</span>
              </div>
              {contact.engagement_sent_count && contact.engagement_sent_count > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {Math.min(Math.round(((contact.engagement_open_count || 0) / contact.engagement_sent_count) * 100), 100)}% rate
                </div>
              )}
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {contact.engagement_click_count || 0}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center space-x-1">
                <MousePointer className="h-4 w-4" />
                <span>Clicks</span>
              </div>
              {contact.engagement_sent_count && contact.engagement_sent_count > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {Math.min(Math.round(((contact.engagement_click_count || 0) / contact.engagement_sent_count) * 100), 100)}% rate
                </div>
              )}
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {contact.engagement_reply_count || 0}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center space-x-1">
                <Reply className="h-4 w-4" />
                <span>Replies</span>
              </div>
              {contact.engagement_sent_count && contact.engagement_sent_count > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {Math.min(Math.round(((contact.engagement_reply_count || 0) / contact.engagement_sent_count) * 100), 100)}% rate
                </div>
              )}
            </div>
          </div>

          {/* Last Positive Engagement */}
          {contact.engagement_last_positive_at && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">Last Positive Engagement</div>
                  <div className="text-sm text-blue-700">
                    {formatDate(contact.engagement_last_positive_at)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      {scoreBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Score Breakdown</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Opens ({contact.engagement_open_count || 0})</span>
                <span className="text-sm text-gray-600">{scoreBreakdown.openScore} points</span>
              </div>
              <Progress value={Math.min((scoreBreakdown.openScore / 15) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Clicks ({contact.engagement_click_count || 0})</span>
                <span className="text-sm text-gray-600">{scoreBreakdown.clickScore} points</span>
              </div>
              <Progress value={Math.min((scoreBreakdown.clickScore / 60) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Replies ({contact.engagement_reply_count || 0})</span>
                <span className="text-sm text-gray-600">{scoreBreakdown.replyScore} points</span>
              </div>
              <Progress value={Math.min((scoreBreakdown.replyScore / 100) * 100, 100)} className="h-2" />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span>Total before time decay:</span>
                <span className="font-medium">{scoreBreakdown.totalBeforeDecay} points</span>
              </div>
              {scoreBreakdown.decayFactor < 1 && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Time decay factor:</span>
                  <span>{Math.round(scoreBreakdown.decayFactor * 100)}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-semibold border-t pt-2 mt-2">
                <span>Final Score:</span>
                <span className={scoreColors.color}>{scoreBreakdown.finalScore} points</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Email Activity Timeline</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading activity...</p>
            </div>
          ) : emailActivity.length > 0 ? (
            <div className="space-y-4">
              {emailActivity.map((activity, index) => (
                <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.subject || 'No Subject'}
                        </h4>
                        {activity.campaign_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            Campaign: {activity.campaign_name}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs ${getActivityStatus(activity).color}`}>
                          {getActivityStatus(activity).label}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDate(activity.sent_at)}
                        </span>
                      </div>
                    </div>

                    {/* Activity Details */}
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <div>Sent: {formatDate(activity.sent_at)}</div>
                      {activity.opened_at && (
                        <div className="text-green-600">
                          Opened: {formatDate(activity.opened_at)}
                        </div>
                      )}
                      {activity.clicked_at && (
                        <div className="text-blue-600">
                          Clicked: {formatDate(activity.clicked_at)}
                        </div>
                      )}
                      {activity.replied_at && (
                        <div className="text-purple-600">
                          Replied: {formatDate(activity.replied_at)}
                        </div>
                      )}
                      {activity.bounced_at && (
                        <div className="text-red-600">
                          Bounced: {formatDate(activity.bounced_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No email activity found</p>
              <p className="text-sm mt-1">Email interactions will appear here once campaigns are sent</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Recommendations</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="font-medium text-blue-900 mb-2">{engagementStatus.actionable}</div>
            <p className="text-sm text-blue-700 mb-4">{engagementStatus.description}</p>

            {engagementStatus.status === 'not_contacted' && (
              <div className="space-y-2">
                <Button size="sm" className="mr-2">
                  Add to Campaign
                </Button>
                <Button variant="outline" size="sm">
                  Send Individual Email
                </Button>
              </div>
            )}

            {engagementStatus.status === 'pending' && (
              <div className="space-y-2">
                <Button size="sm" className="mr-2">
                  Add to Follow-up Campaign
                </Button>
                <Button variant="outline" size="sm">
                  Schedule Follow-up
                </Button>
              </div>
            )}

            {engagementStatus.status === 'engaged' && (
              <div className="space-y-2">
                <Button size="sm" className="mr-2">
                  Move to Sales Pipeline
                </Button>
                <Button variant="outline" size="sm">
                  Schedule Meeting
                </Button>
              </div>
            )}

            {engagementStatus.status === 'bad' && (
              <div className="space-y-2 text-red-700">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">This contact should not be contacted further</span>
                </div>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                  Remove from All Campaigns
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}