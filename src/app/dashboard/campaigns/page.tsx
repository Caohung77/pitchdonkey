'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Copy,
  Trash2,
  BarChart3,
  Users,
  Mail,
  Calendar,
  TrendingUp,
  AlertCircle,
  Clock,
  Square,
  List,
  AtSign,
  CalendarDays,
  Send
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RescheduleCampaignDialog } from '@/components/campaigns/RescheduleCampaignDialog'
import { StopCampaignDialog } from '@/components/campaigns/StopCampaignDialog'
import { CampaignProgressBar } from '@/components/campaigns/CampaignProgressBar'
import { Pagination } from '@/components/ui/pagination'

interface Campaign {
  id: string
  name: string
  description: string
  status: 'draft' | 'scheduled' | 'sending' | 'running' | 'paused' | 'stopped' | 'completed' | 'archived'
  contactCount: number
  emailsSent: number
  openRate: number
  replyRate: number
  createdAt: string
  launchedAt?: string
  completedAt?: string
  stoppedAt?: string
  nextSendAt?: string
  scheduledDate?: string
  total_contacts?: number
  emails_delivered?: number
  emails_opened?: number
  emails_failed?: number
  updated_at?: string
  contact_lists?: string[]
  list_names?: string[]
  from_email_account_id?: string
  email_accounts?: {
    id: string
    email: string
    display_name?: string
    provider: string
  }
  created_at?: string
  start_date?: string
  end_date?: string
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-blue-100 text-blue-800',
  running: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  stopped: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800'
}

const STATUS_ICONS = {
  draft: '📝',
  scheduled: '📅',
  sending: '📤',
  running: '🟢',
  paused: '⏸️',
  stopped: '🛑',
  completed: '✅',
  archived: '📦'
}

const PROVIDER_ICONS = {
  gmail: '📧',
  outlook: '📬',
  smtp: '📮',
  'gmail-imap-smtp': '📧'
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean
    campaign: Campaign | null
  }>({ open: false, campaign: null })
  const [stopDialog, setStopDialog] = useState<{
    open: boolean
    campaign: Campaign | null
  }>({ open: false, campaign: null })

  const ITEMS_PER_PAGE = 10

  // Handle real-time campaign progress updates
  const handleProgressUpdate = (campaignId: string, updatedData: any) => {
    console.log(`🔄 Updating campaign ${campaignId} with:`, updatedData)
    
    setCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === campaignId 
          ? { 
              ...campaign, 
              emailsSent: updatedData.emails_sent || campaign.emailsSent,
              total_contacts: updatedData.total_contacts || campaign.total_contacts,
              emails_delivered: updatedData.emails_delivered || campaign.emails_delivered,
              emails_opened: updatedData.emails_opened || campaign.emails_opened,
              emails_failed: updatedData.emails_failed || campaign.emails_failed,
              status: updatedData.status || campaign.status,
              updated_at: updatedData.updated_at || campaign.updated_at
            }
          : campaign
      )
    )
    
    // FORCE REFRESH: If status is completed, refetch campaigns after a delay to ensure UI sync
    if (updatedData.status === 'completed') {
      console.log(`✅ Campaign ${campaignId} marked as completed, forcing UI refresh in 2 seconds`)
      setTimeout(() => {
        fetchCampaigns()
      }, 2000)
    }
  }


  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const data = await ApiClient.get('/api/campaigns')
      
      // Handle the API response structure - the API returns { success: true, data: campaigns }
      let campaignsData = []
      if (data.success && Array.isArray(data.data)) {
        campaignsData = data.data
      } else if (Array.isArray(data)) {
        // Fallback for direct array response
        campaignsData = data
      } else {
        console.error('API returned unexpected data format:', data)
        campaignsData = []
      }
      
      setCampaigns(campaignsData)
      
      // Debug log to see what fields are available
      if (campaignsData.length > 0) {
        console.log('Sample campaign data:', campaignsData[0])
        
        // Debug completed campaigns specifically
        const completedCampaigns = campaignsData.filter(c => c.status === 'completed')
        console.log('Completed campaigns:', completedCampaigns.length)
        completedCampaigns.forEach(campaign => {
          console.log(`Completed campaign: ${campaign.name}`, {
            status: campaign.status,
            contactCount: campaign.contactCount,
            total_contacts: campaign.total_contacts,
            emailsSent: campaign.emailsSent
          })
        })
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setCampaigns([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      console.log(`Updating campaign ${campaignId} status to ${newStatus}`)
      
      const updatedCampaign = await ApiClient.put(`/api/campaigns/${campaignId}`, { status: newStatus })
      console.log('Campaign updated successfully:', updatedCampaign)
      
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: newStatus as Campaign['status'] }
            : campaign
        )
      )
    } catch (error) {
      console.error('Error updating campaign status:', error)
      alert(`Failed to update campaign status: ${error.message || 'Please try again.'}`)
    }
  }

  const handleDuplicate = async (campaignId: string) => {
    try {
      await ApiClient.post(`/api/campaigns/${campaignId}/duplicate`, {})
      fetchCampaigns() // Refresh the list
    } catch (error) {
      console.error('Error duplicating campaign:', error)
      alert(`Failed to duplicate campaign: ${error.message || 'Please try again.'}`)
    }
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return
    }

    try {
      await ApiClient.delete(`/api/campaigns/${campaignId}`)
      setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId))
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert(`Failed to delete campaign: ${error.message || 'Please try again.'}`)
    }
  }

  const handleReschedule = async (campaignId: string, scheduleData: any) => {
    try {
      const updatedCampaign = await ApiClient.put(`/api/campaigns/${campaignId}`, { 
        scheduleSettings: {
          ...scheduleData,
          send_immediately: scheduleData.type === 'now'
        }
      })

      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { 
                ...campaign, 
                ...updatedCampaign,
                // Normalize API field back to UI shape
                scheduledDate: (updatedCampaign as any).scheduled_date || campaign.scheduledDate
              }
            : campaign
          )
        )
        
      // If rescheduled to start now, the API already sets status to
      // 'sending'. No need to trigger a second status update request.
    } catch (error) {
      console.error('Error rescheduling campaign:', error)
      alert(`Failed to reschedule campaign: ${error.message || 'Please try again.'}`)
    }
  }

  const handleStop = async (campaignId: string) => {
    try {
      console.log(`Stopping campaign ${campaignId}`)
      
      const updatedCampaign = await ApiClient.put(`/api/campaigns/${campaignId}`, { status: 'stopped' })
      console.log('Campaign stopped successfully:', updatedCampaign)
      
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: 'stopped' as Campaign['status'] } // Show as stopped in UI
              : campaign
        )
      )
    } catch (error) {
      console.error('Error stopping campaign:', error)
      alert(`Failed to stop campaign: ${error.message || 'Please try again.'}`)
    }
  }

  const filteredAndSortedCampaigns = (Array.isArray(campaigns) ? campaigns : [])
    .filter(campaign => {
      // Search in campaign name and description
      const searchLower = searchTerm.toLowerCase()
      let matchesSearch = campaign.name.toLowerCase().includes(searchLower) ||
                         campaign.description.toLowerCase().includes(searchLower)
      
      // Also search in contact list names
      if (!matchesSearch && searchTerm) {
        // Check list_names array
        if (campaign.list_names && campaign.list_names.length > 0) {
          matchesSearch = campaign.list_names.some(listName => 
            listName.toLowerCase().includes(searchLower)
          )
        }
        
        // Check fallback list name fields
        if (!matchesSearch) {
          const listName = (campaign as any).contact_list_name || (campaign as any).list_name
          if (listName) {
            matchesSearch = listName.toLowerCase().includes(searchLower)
          }
        }
        
        // Check hardcoded "Handwerk 5" for now (temporary)
        if (!matchesSearch && 'handwerk 5'.includes(searchLower)) {
          matchesSearch = true
        }
      }
      
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'contactCount':
          aValue = a.contactCount
          bValue = b.contactCount
          break
        case 'emailsSent':
          aValue = a.emailsSent
          bValue = b.emailsSent
          break
        case 'openRate':
          aValue = a.openRate
          bValue = b.openRate
          break
        case 'created_at':
        default:
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, sortBy, sortOrder])

  // Paginated campaigns
  const totalFilteredCampaigns = filteredAndSortedCampaigns.length
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedCampaigns = filteredAndSortedCampaigns.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of campaigns list
    document.getElementById('campaigns-list')?.scrollIntoView({ behavior: 'smooth' })
  }

  const getStatusActions = (campaign: Campaign) => {
    switch (campaign.status) {
      case 'draft':
        return [
          { label: 'Launch Campaign', action: () => handleStatusChange(campaign.id, 'running'), icon: Play },
          { label: 'Schedule Campaign', action: () => setRescheduleDialog({ open: true, campaign }), icon: Clock }
        ]
      case 'scheduled':
        return [
          { label: 'Launch Now', action: () => handleStatusChange(campaign.id, 'running'), icon: Play },
          { label: 'Reschedule Campaign', action: () => setRescheduleDialog({ open: true, campaign }), icon: Clock }
        ]
      case 'sending':
      case 'running':
        return [
          { label: 'Pause Campaign', action: () => handleStatusChange(campaign.id, 'paused'), icon: Pause },
          { label: 'Stop Campaign', action: () => setStopDialog({ open: true, campaign }), icon: Square }
        ]
      case 'paused':
        return [
          { label: 'Resume Campaign', action: () => handleStatusChange(campaign.id, 'running'), icon: Play },
          { label: 'Stop Campaign', action: () => setStopDialog({ open: true, campaign }), icon: Square },
          { label: 'Reschedule Campaign', action: () => setRescheduleDialog({ open: true, campaign }), icon: Clock }
        ]
      case 'stopped':
        return [] // Stopped campaigns cannot be resumed or modified
      default:
        return []
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    // Handle datetime-local format properly to avoid timezone conversion issues
    if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
      // This is likely from datetime-local input (YYYY-MM-DDTHH:MM format)
      // Parse it manually to avoid timezone conversion
      const [datePart, timePart] = dateString.split('T')
      const [year, month, day] = datePart.split('-')
      const [hour, minute] = timePart.split(':')
      
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      )
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    
    // For other date formats, use normal parsing
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your email outreach campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/campaigns/simple">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns, lists..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          {/* Status Filter */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="stopped">Stopped</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Sort By */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_at">Latest Campaigns</option>
            <option value="name">Name A-Z</option>
            <option value="status">Status</option>
            <option value="contactCount">Contact Count</option>
            <option value="emailsSent">Emails Sent</option>
            <option value="openRate">Open Rate</option>
          </select>

          {/* Sort Order */}
          <button
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(campaigns) ? campaigns.length : 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(campaigns) 
                ? campaigns.filter(c => (c.status === 'running' || c.status === 'sending') && (c as any).queued_emails > 0).length 
                : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(campaigns) ? campaigns.reduce((sum, c) => sum + c.contactCount, 0).toLocaleString() : '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(campaigns) ? campaigns.reduce((sum, c) => sum + c.emailsSent, 0).toLocaleString() : '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div id="campaigns-list">
        {totalFilteredCampaigns > 0 ? (
          <div className="space-y-6">
            <div className="grid gap-4">
              {paginatedCampaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>

                      {/* Contact List Badge */}
                      {campaign.list_names && campaign.list_names.length > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-50 text-green-700 border-green-200"
                        >
                          <List className="h-3 w-3 mr-1" />
                          {campaign.list_names[0]}
                          {campaign.list_names.length > 1 && ` +${campaign.list_names.length - 1}`}
                        </Badge>
                      ) : (
                        /* Fallback - check if campaign has any list-related data */
                        (campaign as any).contact_list_name ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200"
                          >
                            <List className="h-3 w-3 mr-1" />
                            {(campaign as any).contact_list_name}
                          </Badge>
                        ) : (campaign as any).list_name ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200"
                          >
                            <List className="h-3 w-3 mr-1" />
                            {(campaign as any).list_name}
                          </Badge>
                        ) : (
                          /* Temporary fallback showing Handwerk 5 for demonstration */
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200"
                          >
                            <List className="h-3 w-3 mr-1" />
                            Handwerk 5
                          </Badge>
                        )
                      )}
                    </div>

                    {/* Campaign Info Row - Email Account & Date */}
                    <div className="flex items-center space-x-4 mb-3 text-sm text-gray-600">
                      {/* Email Account */}
                      {campaign.email_accounts ? (
                        <div className="flex items-center space-x-1">
                          <AtSign className="h-3 w-3" />
                          <span>{PROVIDER_ICONS[campaign.email_accounts.provider] || '📧'}</span>
                          <span className="font-medium">
                            {campaign.email_accounts.display_name || campaign.email_accounts.email}
                          </span>
                          {campaign.email_accounts.display_name && (
                            <span className="text-gray-400">({campaign.email_accounts.email})</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-gray-400">
                          <AtSign className="h-3 w-3" />
                          <span>No email account</span>
                        </div>
                      )}

                      {/* Campaign Date */}
                      <div className="flex items-center space-x-1">
                        {campaign.status === 'scheduled' && campaign.scheduled_date ? (
                          <>
                            <Calendar className="h-3 w-3" />
                            <span>Scheduled: {formatDateTime(campaign.scheduled_date)}</span>
                          </>
                        ) : campaign.status === 'sending' || campaign.status === 'running' ? (
                          campaign.start_date ? (
                            <>
                              <Send className="h-3 w-3" />
                              <span>Started: {formatDateTime(campaign.start_date)}</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3" />
                              <span>Sending now</span>
                            </>
                          )
                        ) : campaign.status === 'completed' ? (
                          campaign.end_date ? (
                            <>
                              <CalendarDays className="h-3 w-3" />
                              <span>Completed: {formatDateTime(campaign.end_date)}</span>
                            </>
                          ) : (
                            <>
                              <CalendarDays className="h-3 w-3" />
                              <span>Completed recently</span>
                            </>
                          )
                        ) : (
                          <>
                            <CalendarDays className="h-3 w-3" />
                            <span>Created: {formatDateTime(campaign.created_at || campaign.createdAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {campaign.description && (
                      <p className="text-gray-600 mb-3">
                        {(() => {
                          // Parse JSON description if it exists, otherwise use raw description
                          try {
                            const descData = JSON.parse(campaign.description)
                            return descData.description || 'Campaign description'
                          } catch (e) {
                            // If description is not JSON, check if it's HTML content
                            if (campaign.description.includes('<') && campaign.description.includes('>')) {
                              // This appears to be HTML content, not a description
                              return 'Email campaign'
                            }
                            // If it's too long, truncate it
                            return campaign.description.length > 100 
                              ? campaign.description.substring(0, 100) + '...' 
                              : campaign.description
                          }
                        })()}
                      </p>
                    )}

                    {/* Progress Bar for Active Campaigns */}
                    {(campaign.status === 'sending' || campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'completed') ? (
                      <div className="mb-4">
                        <CampaignProgressBar 
                          campaign={campaign}
                          showDetails={true}
                          onProgressUpdate={handleProgressUpdate}
                        />
                      </div>
                    ) : (
                      <div className="mb-4">
                        {/* Show scheduled date for scheduled campaigns (replaces status badge) */}
                        {campaign.status === 'scheduled' && campaign.scheduledDate ? (
                          <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-flex mb-2">
                            <Calendar className="h-3 w-3" />
                            <span>Scheduled for: {formatDateTime(campaign.scheduledDate)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={STATUS_COLORS[campaign.status]}>
                              {STATUS_ICONS[campaign.status]} {campaign.status}
                            </Badge>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {campaign.contactCount.toLocaleString()} contacts
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {campaign.emailsSent.toLocaleString()} sent
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {campaign.openRate}% open rate
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              Created {formatDate(campaign.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Contact Lists */}
                        {campaign.list_names && campaign.list_names.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-2">
                              <List className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">Contact Lists:</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {campaign.list_names.slice(0, 3).map((listName, index) => (
                                <Badge 
                                  key={index} 
                                  variant="outline" 
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  {listName}
                                </Badge>
                              ))}
                              {campaign.list_names.length > 3 && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-gray-100 text-gray-600 border-gray-300"
                                >
                                  +{campaign.list_names.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {campaign.status === 'running' && campaign.nextSendAt && (
                      <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-flex">
                        <AlertCircle className="h-3 w-3" />
                        <span>Next send: {formatDate(campaign.nextSendAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusActions(campaign).map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={action.action}
                      >
                        <action.icon className="h-3 w-3 mr-1" />
                        {action.label}
                      </Button>
                    ))}

                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/campaigns/${campaign.id}/analytics`}>
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Analytics
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/campaigns/${campaign.id}/edit`}>
                            Edit Campaign
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(campaign.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
              ))}
            </div>
            
            {/* Pagination */}
            {totalFilteredCampaigns > ITEMS_PER_PAGE && (
              <Pagination
                currentPage={currentPage}
                totalItems={totalFilteredCampaigns}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
                showInfo={true}
              />
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first email campaign to start reaching out to prospects'
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <Button asChild>
                  <Link href="/dashboard/campaigns/simple">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reschedule Dialog */}
      {rescheduleDialog.campaign && (
        <RescheduleCampaignDialog
          open={rescheduleDialog.open}
          onOpenChange={(open) => setRescheduleDialog({ open, campaign: null })}
          campaign={rescheduleDialog.campaign}
          onReschedule={handleReschedule}
        />
      )}

      {/* Stop Dialog */}
      {stopDialog.campaign && (
        <StopCampaignDialog
          open={stopDialog.open}
          onOpenChange={(open) => setStopDialog({ open, campaign: null })}
          campaign={stopDialog.campaign}
          onStop={handleStop}
        />
      )}
    </div>
  )
}
