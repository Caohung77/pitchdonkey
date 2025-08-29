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
  Square
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
  total_contacts?: number
  emails_delivered?: number
  emails_opened?: number
  emails_failed?: number
  updated_at?: string
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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [fixingStuckCampaigns, setFixingStuckCampaigns] = useState(false)
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

  const fixStuckCampaigns = async () => {
    setFixingStuckCampaigns(true)
    try {
      const response = await fetch('/api/campaigns/fix-stuck-campaigns', {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Fixed stuck campaigns:', result)
        // Refresh campaigns to show updated statuses
        fetchCampaigns()
        
        if (result.campaigns_fixed > 0) {
          alert(`Fixed ${result.campaigns_fixed} stuck campaigns!`)
        } else {
          alert('No stuck campaigns found.')
        }
      } else {
        console.error('❌ Failed to fix stuck campaigns:', result.error)
        alert('Failed to fix stuck campaigns. Check console for details.')
      }
    } catch (error) {
      console.error('❌ Error fixing stuck campaigns:', error)
      alert('Error fixing stuck campaigns. Check console for details.')
    } finally {
      setFixingStuckCampaigns(false)
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
            ? { ...campaign, ...updatedCampaign }
            : campaign
          )
        )
        
      // If rescheduled to start now, also update status to active
      if (scheduleData.type === 'now') {
        await handleStatusChange(campaignId, 'active')
      }
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

  const filteredCampaigns = (Array.isArray(campaigns) ? campaigns : []).filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  // Paginated campaigns
  const totalFilteredCampaigns = filteredCampaigns.length
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedCampaigns = filteredCampaigns.slice(startIndex, endIndex)

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
        <div className="flex items-center space-x-3">
          <Button asChild>
            <Link href="/dashboard/campaigns/simple">
              <Plus className="h-4 w-4 mr-2" />
              Simple Campaign
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/campaigns/new">
              Advanced Campaign
            </Link>
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={fixStuckCampaigns}
            disabled={fixingStuckCampaigns}
            title="Fix campaigns stuck in 'Sending' status"
          >
            {fixingStuckCampaigns ? 'Fixing...' : 'Fix Status'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2 border border-gray-300 rounded-md"
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
              {Array.isArray(campaigns) ? campaigns.filter(c => c.status === 'running' || c.status === 'sending').length : 0}
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
                    </div>
                    
                    {campaign.description && (
                      <p className="text-gray-600 mb-3">
                        {(() => {
                          // Parse JSON description if it exists, otherwise use raw description
                          try {
                            const descData = JSON.parse(campaign.description)
                            return descData.description || campaign.description
                          } catch (e) {
                            return campaign.description
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
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={STATUS_COLORS[campaign.status]}>
                            {STATUS_ICONS[campaign.status]} {campaign.status}
                          </Badge>
                        </div>
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
                <div className="flex items-center space-x-3">
                  <Button asChild>
                    <Link href="/dashboard/campaigns/simple">
                      <Plus className="h-4 w-4 mr-2" />
                      Simple Campaign
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/campaigns/new">
                      Advanced Campaign
                    </Link>
                  </Button>
                </div>
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