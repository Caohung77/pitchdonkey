'use client'

import { useState, useEffect } from 'react'
import { Contact } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Send,
  List,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  MousePointer,
  Reply,
  Bounce
} from 'lucide-react'

interface CampaignsListsTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

interface CampaignHistory {
  id: string
  name: string
  status: string
  joined_at: string
  current_step: number
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  last_sent_at?: string
  last_open_at?: string
  last_click_at?: string
  last_reply_at?: string
}

export function CampaignsListsTab({
  contact,
  onContactUpdate
}: CampaignsListsTabProps) {
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistory[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignPage, setCampaignPage] = useState(1)
  const [campaignPagination, setCampaignPagination] = useState<{
    page: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  } | null>(null)

  // Load campaign history for the contact
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!contact.id) return

      try {
        setCampaignsLoading(true)
        const resp = await fetch(`/api/contacts/${contact.id}/campaigns?page=${campaignPage}&limit=10`)
        if (resp.ok) {
          const json = await resp.json()
          setCampaignHistory(json.campaigns || [])
          setCampaignPagination(json.pagination || null)
        } else {
          setCampaignHistory([])
          setCampaignPagination(null)
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
      } finally {
        setCampaignsLoading(false)
      }
    }

    loadCampaigns()
  }, [contact.id, campaignPage])

  // Reset pagination when tab opens
  useEffect(() => {
    setCampaignPage(1)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'stopped':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'stopped':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const calculateEngagementRate = (opened: number, sent: number): number => {
    if (sent === 0) return 0
    return Math.round((opened / sent) * 100)
  }

  const calculateClickRate = (clicked: number, opened: number): number => {
    if (opened === 0) return 0
    return Math.round((clicked / opened) * 100)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Send className="h-5 w-5 text-gray-600" />
            Campaigns & Lists
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Campaign participation history and list memberships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="flex items-center gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Add to Campaign
          </Button>
          <Button variant="outline" className="flex items-center gap-2" size="sm">
            <List className="h-4 w-4" />
            Manage Lists
          </Button>
        </div>
      </div>

      {/* Contact Lists Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Contact Lists</h3>
        </div>

        {contact.lists && contact.lists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contact.lists.map((listName: string, index: number) => (
              <Card key={index} className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">{listName}</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <List className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Not in any lists</h4>
              <p className="text-gray-600 mb-4">This contact hasn't been added to any contact lists yet</p>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add to List
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Campaign History Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Campaign History</h3>
        </div>

        {campaignsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading campaigns...</p>
          </div>
        ) : campaignHistory.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Send className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No campaign history</h4>
              <p className="text-gray-600 mb-4">This contact hasn't been included in any campaigns yet</p>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add to Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaignHistory.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* Campaign Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(campaign.status)}
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{campaign.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Joined {new Date(campaign.joined_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            <span>Step {campaign.current_step || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>

                  {/* Campaign Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">Sent</span>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {campaign.emails_sent || 0}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-500">Opened</span>
                      </div>
                      <div className="text-lg font-semibold text-green-600">
                        {campaign.emails_opened || 0}
                      </div>
                      {campaign.emails_sent > 0 && (
                        <div className="text-xs text-green-500">
                          {calculateEngagementRate(campaign.emails_opened || 0, campaign.emails_sent)}%
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MousePointer className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-500">Clicked</span>
                      </div>
                      <div className="text-lg font-semibold text-blue-600">
                        {campaign.emails_clicked || 0}
                      </div>
                      {campaign.emails_opened > 0 && (
                        <div className="text-xs text-blue-500">
                          {calculateClickRate(campaign.emails_clicked || 0, campaign.emails_opened || 0)}%
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Reply className="h-4 w-4 text-purple-500" />
                        <span className="text-sm text-gray-500">Replied</span>
                      </div>
                      <div className="text-lg font-semibold text-purple-600">
                        {campaign.emails_replied || 0}
                      </div>
                    </div>
                  </div>

                  {/* Last Activity */}
                  {(campaign.last_sent_at || campaign.last_open_at || campaign.last_reply_at || campaign.last_click_at) && (
                    <div className="pt-4 border-t border-gray-200">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Last Activity</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-600">
                        {campaign.last_sent_at && (
                          <div>
                            <span className="font-medium">Last sent:</span>
                            <br />
                            {new Date(campaign.last_sent_at).toLocaleString()}
                          </div>
                        )}
                        {campaign.last_open_at && (
                          <div>
                            <span className="font-medium text-green-600">Last open:</span>
                            <br />
                            {new Date(campaign.last_open_at).toLocaleString()}
                          </div>
                        )}
                        {campaign.last_click_at && (
                          <div>
                            <span className="font-medium text-blue-600">Last click:</span>
                            <br />
                            {new Date(campaign.last_click_at).toLocaleString()}
                          </div>
                        )}
                        {campaign.last_reply_at && (
                          <div>
                            <span className="font-medium text-purple-600">Last reply:</span>
                            <br />
                            {new Date(campaign.last_reply_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {campaignPagination && (campaignPagination.hasNextPage || campaignPagination.hasPrevPage) && !campaignsLoading && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Page {campaignPagination.page}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!campaignPagination.hasPrevPage}
                onClick={() => setCampaignPage(campaignPage - 1)}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!campaignPagination.hasNextPage}
                onClick={() => setCampaignPage(campaignPage + 1)}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Campaign Performance Summary */}
      {campaignHistory.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Performance</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {campaignHistory.reduce((sum, c) => sum + (c.emails_sent || 0), 0)}
                </div>
                <div className="text-sm text-gray-500">Total Emails Sent</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  {campaignHistory.reduce((sum, c) => sum + (c.emails_opened || 0), 0)}
                </div>
                <div className="text-sm text-gray-500">Total Opens</div>
                <div className="text-xs text-green-500 mt-1">
                  {calculateEngagementRate(
                    campaignHistory.reduce((sum, c) => sum + (c.emails_opened || 0), 0),
                    campaignHistory.reduce((sum, c) => sum + (c.emails_sent || 0), 0)
                  )}% Rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <MousePointer className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">
                  {campaignHistory.reduce((sum, c) => sum + (c.emails_clicked || 0), 0)}
                </div>
                <div className="text-sm text-gray-500">Total Clicks</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Reply className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  {campaignHistory.reduce((sum, c) => sum + (c.emails_replied || 0), 0)}
                </div>
                <div className="text-sm text-gray-500">Total Replies</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}