'use client'

import { useState, useEffect } from 'react'
import { Contact } from '@/lib/contacts'
import { EngagementBreakdown } from '../EngagementBreakdown'
import { EngagementTimeline, type EngagementEvent } from '../EngagementTimeline'
import type { ContactEngagementStatus } from '@/lib/contact-engagement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, TrendingUp, Activity, AlertCircle } from 'lucide-react'

interface EngagementTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function EngagementTab({
  contact,
  onContactUpdate
}: EngagementTabProps) {
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEngagementEvents = async () => {
      if (!contact.id) {
        setEngagementEvents([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/contacts/${contact.id}/engagement`)
        if (!response.ok) {
          throw new Error(`Failed to load engagement events (${response.status})`)
        }

        const json = await response.json()
        if (json.success && Array.isArray(json.events)) {
          setEngagementEvents(json.events)
        } else {
          setEngagementEvents([])
        }
      } catch (error) {
        console.error('Error loading engagement events:', error)
        setError(error instanceof Error ? error.message : 'Failed to load engagement data')
        setEngagementEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEngagementEvents()
  }, [contact.id])

  const recalculateEngagement = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/contacts/recalculate-engagement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contact_ids: [contact.id] })
      })

      if (!response.ok) {
        throw new Error('Failed to recalculate engagement')
      }

      // Refresh contact data
      const contactResponse = await fetch(`/api/contacts?ids=${contact.id}`)
      if (contactResponse.ok) {
        const result = await contactResponse.json()
        const updatedContact = result.data?.contacts?.[0]
        if (updatedContact) {
          onContactUpdate(updatedContact)
        }
      }

      // Refresh engagement events
      const eventsResponse = await fetch(`/api/contacts/${contact.id}/engagement`)
      if (eventsResponse.ok) {
        const eventsResult = await eventsResponse.json()
        if (eventsResult.success && Array.isArray(eventsResult.events)) {
          setEngagementEvents(eventsResult.events)
        }
      }
    } catch (error) {
      console.error('Error recalculating engagement:', error)
      setError('Failed to recalculate engagement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-gray-600" />
            Engagement Analytics
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track email interactions and engagement patterns
          </p>
        </div>
        <Button
          onClick={recalculateEngagement}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          {loading ? 'Recalculating...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left: Engagement Breakdown */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Engagement Overview</h3>

          <EngagementBreakdown
            status={((contact as any).engagement_status || 'not_contacted') as ContactEngagementStatus}
            score={(contact as any).engagement_score || 0}
            openCount={(contact as any).engagement_open_count || 0}
            clickCount={(contact as any).engagement_click_count || 0}
            replyCount={(contact as any).engagement_reply_count || 0}
            bounceCount={(contact as any).engagement_bounce_count || 0}
            sentCount={(contact as any).engagement_sent_count || 0}
            lastPositiveAt={(contact as any).engagement_last_positive_at}
          />

          {/* Quick Actions based on engagement status */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Recommended Actions</h4>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const status = (contact as any).engagement_status || 'not_contacted'
                const score = (contact as any).engagement_score || 0

                switch (status) {
                  case 'not_contacted':
                    return (
                      <>
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">
                          🚀 Ready for first outreach
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">
                          📝 Add to campaign
                        </Badge>
                      </>
                    )
                  case 'pending':
                    return (
                      <>
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer">
                          📧 Send follow-up email
                        </Badge>
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer">
                          📞 Try different approach
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer">
                          ⏰ Schedule reminder
                        </Badge>
                      </>
                    )
                  case 'engaged':
                    return (
                      <>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">
                          🎯 Prioritize for sales
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer">
                          📅 Schedule call
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">
                          💼 Move to CRM
                        </Badge>
                      </>
                    )
                  case 'bad':
                    return (
                      <>
                        <Badge className="bg-red-100 text-red-800">
                          🚫 Automatically excluded from campaigns
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-800 cursor-pointer">
                          🔄 Review for re-engagement
                        </Badge>
                      </>
                    )
                  default:
                    return (
                      <Badge className="bg-gray-100 text-gray-800">
                        📊 Analyzing engagement patterns...
                      </Badge>
                    )
                }
              })()}
            </div>

            {/* Engagement Tips */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Engagement Tips
              </h5>
              <div className="space-y-2 text-sm text-gray-600">
                {(contact as any).engagement_score !== undefined && (contact as any).engagement_score < 0.3 ? (
                  <>
                    <p>• Consider personalizing email subject lines</p>
                    <p>• Try sending at different times of day</p>
                    <p>• Review email content for relevance</p>
                  </>
                ) : (contact as any).engagement_score !== undefined && (contact as any).engagement_score > 0.7 ? (
                  <>
                    <p>• This contact is highly engaged - prioritize follow-up</p>
                    <p>• Consider moving to personal outreach</p>
                    <p>• Share valuable content to maintain interest</p>
                  </>
                ) : (
                  <>
                    <p>• Monitor engagement patterns for optimization</p>
                    <p>• A/B test different approaches</p>
                    <p>• Maintain consistent follow-up schedule</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Activity Timeline */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600" />
            Activity Timeline
          </h3>

          <EngagementTimeline
            events={engagementEvents}
            maxEvents={20}
            className={loading ? 'opacity-75 animate-pulse' : ''}
          />

          {engagementEvents.length === 0 && !loading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Activity Yet</h4>
              <p className="text-gray-600 mb-4">
                This contact hasn't been included in any email campaigns yet.
              </p>
              <Button className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Add to Campaign
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Detailed Statistics</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(contact as any).engagement_sent_count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Emails Sent</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {(contact as any).engagement_open_count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Opened</div>
            {(contact as any).engagement_sent_count && (contact as any).engagement_sent_count > 0 && (
              <div className="text-xs text-green-600">
                {Math.min(Math.round((((contact as any).engagement_open_count || 0) / (contact as any).engagement_sent_count) * 100), 100)}%
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(contact as any).engagement_click_count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Clicked</div>
            {(contact as any).engagement_sent_count && (contact as any).engagement_sent_count > 0 && (
              <div className="text-xs text-blue-600">
                {Math.min(Math.round((((contact as any).engagement_click_count || 0) / (contact as any).engagement_sent_count) * 100), 100)}%
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {(contact as any).engagement_reply_count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Replied</div>
            {(contact as any).engagement_sent_count && (contact as any).engagement_sent_count > 0 && (
              <div className="text-xs text-purple-600">
                {Math.min(Math.round((((contact as any).engagement_reply_count || 0) / (contact as any).engagement_sent_count) * 100), 100)}%
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {(contact as any).engagement_bounce_count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Bounced</div>
            {(contact as any).engagement_sent_count && (contact as any).engagement_sent_count > 0 && (
              <div className="text-xs text-red-600">
                {Math.min(Math.round((((contact as any).engagement_bounce_count || 0) / (contact as any).engagement_sent_count) * 100), 100)}%
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {(contact as any).engagement_score !== undefined ? Math.min(Math.round((contact as any).engagement_score * 100), 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Score</div>
          </div>
        </div>
      </div>
    </div>
  )
}