'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  AlertCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Campaign {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  contactCount: number
  emailsSent: number
  openRate: number
  replyRate: number
  createdAt: string
  launchedAt?: string
  completedAt?: string
  nextSendAt?: string
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  running: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800'
}

const STATUS_ICONS = {
  draft: '📝',
  running: '🟢',
  paused: '⏸️',
  completed: '✅'
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setCampaigns(data)
      } else {
        console.error('API returned non-array data:', data)
        setCampaigns([]) // Set empty array as fallback
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
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setCampaigns(prev => 
          prev.map(campaign => 
            campaign.id === campaignId 
              ? { ...campaign, status: newStatus as Campaign['status'] }
              : campaign
          )
        )
      }
    } catch (error) {
      console.error('Error updating campaign status:', error)
    }
  }

  const handleDuplicate = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchCampaigns() // Refresh the list
      }
    } catch (error) {
      console.error('Error duplicating campaign:', error)
    }
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId))
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
    }
  }

  const filteredCampaigns = (Array.isArray(campaigns) ? campaigns : []).filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusActions = (campaign: Campaign) => {
    switch (campaign.status) {
      case 'draft':
        return [
          { label: 'Launch Campaign', action: () => handleStatusChange(campaign.id, 'running'), icon: Play }
        ]
      case 'running':
        return [
          { label: 'Pause Campaign', action: () => handleStatusChange(campaign.id, 'paused'), icon: Pause }
        ]
      case 'paused':
        return [
          { label: 'Resume Campaign', action: () => handleStatusChange(campaign.id, 'running'), icon: Play }
        ]
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
        <Button asChild>
          <Link href="/dashboard/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </Button>
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
          <option value="running">Running</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
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
              {Array.isArray(campaigns) ? campaigns.filter(c => c.status === 'running').length : 0}
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
      {filteredCampaigns.length > 0 ? (
        <div className="grid gap-4">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <Badge className={STATUS_COLORS[campaign.status]}>
                        {STATUS_ICONS[campaign.status]} {campaign.status}
                      </Badge>
                    </div>
                    
                    {campaign.description && (
                      <p className="text-gray-600 mb-3">{campaign.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                <Link href="/dashboard/campaigns/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Campaign
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}