'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Target,
  Users,
  Mail,
  Calendar,
  Plus,
  Search,
  ExternalLink,
  Play,
  Pause,
  Settings,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Contact {
  id: string
  first_name?: string
  last_name?: string
  email: string
}

interface Campaign {
  id: string
  name: string
  status?: string | null
  total_contacts?: number | null
  contact_status?: string | null
  current_step?: number | null
  joined_at?: string | null
  campaign_created_at?: string | null
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  open_rate?: number
  click_rate?: number
  reply_rate?: number
}

interface ContactList {
  id: string
  name: string
  description?: string | null
  contact_count: number
  created_at?: string | null
  updated_at?: string | null
  is_member?: boolean
  tags?: string[]
}

interface CampaignsListsTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function CampaignsListsTab({ contact, onContactUpdate }: CampaignsListsTabProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [listsLoading, setListsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'lists'>('campaigns')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [campaignPage, setCampaignPage] = useState(1)
  const [listPage, setListPage] = useState(1)
  const [campaignPagination, setCampaignPagination] = useState({ page: 1, limit: 10, hasNextPage: false, hasPrevPage: false })
  const [listPagination, setListPagination] = useState({ page: 1, limit: 10, hasNextPage: false, hasPrevPage: false })

  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'

  useEffect(() => {
    setCampaignPage(1)
  }, [contact.id, statusFilter])

  useEffect(() => {
    setListPage(1)
  }, [contact.id])

  useEffect(() => {
    setCampaignPage(1)
    setListPage(1)
  }, [searchTerm])

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCampaigns()
    }, 250)

    return () => clearTimeout(handler)
  }, [contact.id, campaignPage, searchTerm, statusFilter])

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLists()
    }, 250)

    return () => clearTimeout(handler)
  }, [contact.id, listPage, searchTerm])

  const fetchCampaigns = async () => {
    setCampaignsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(campaignPage),
        limit: '10',
      })

      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/contacts/${contact.id}/campaigns?${params.toString()}`)

      if (!response.ok) {
        console.error('Campaigns request failed with status', response.status)
        setCampaigns([])
        setCampaignPagination({ page: campaignPage, limit: 10, hasNextPage: false, hasPrevPage: campaignPage > 1 })
        return
      }

      const payload = await response.json()
      if (!payload.success) {
        console.warn('Failed to load campaigns for contact:', payload.error)
        setCampaigns([])
        setCampaignPagination({ page: campaignPage, limit: 10, hasNextPage: false, hasPrevPage: campaignPage > 1 })
        return
      }

      const normalized: Campaign[] = (payload.campaigns || []).map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name || 'Untitled Campaign',
        status: campaign.status,
        total_contacts: campaign.total_contacts ?? null,
        contact_status: campaign.contact_status,
        current_step: campaign.current_step ?? null,
        joined_at: campaign.joined_at ?? null,
        campaign_created_at: campaign.campaign_created_at ?? null,
        emails_sent: campaign.emails_sent ?? 0,
        emails_opened: campaign.emails_opened ?? 0,
        emails_clicked: campaign.emails_clicked ?? 0,
        emails_replied: campaign.emails_replied ?? 0,
        open_rate: typeof campaign.open_rate === 'number' ? campaign.open_rate : undefined,
        click_rate: typeof campaign.click_rate === 'number' ? campaign.click_rate : undefined,
        reply_rate: typeof campaign.reply_rate === 'number' ? campaign.reply_rate : undefined,
      }))

      setCampaigns(normalized)
      setCampaignPagination(payload.pagination ?? { page: campaignPage, limit: 10, hasNextPage: false, hasPrevPage: campaignPage > 1 })
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
      setCampaigns([])
      setCampaignPagination({ page: campaignPage, limit: 10, hasNextPage: false, hasPrevPage: campaignPage > 1 })
    } finally {
      setCampaignsLoading(false)
    }
  }

  const fetchLists = async () => {
    setListsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(listPage),
        limit: '10',
      })

      if (searchTerm) params.set('search', searchTerm)

      const response = await fetch(`/api/contacts/${contact.id}/lists?${params.toString()}`)

      if (!response.ok) {
        console.error('Lists request failed with status', response.status)
        setContactLists([])
        setListPagination({ page: listPage, limit: 10, hasNextPage: false, hasPrevPage: listPage > 1 })
        return
      }

      const payload = await response.json()
      if (!payload.success) {
        console.warn('Failed to load contact lists for contact:', payload.error)
        setContactLists([])
        setListPagination({ page: listPage, limit: 10, hasNextPage: false, hasPrevPage: listPage > 1 })
        return
      }

      const normalizedLists: ContactList[] = (payload.lists || []).map((list: any) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        contact_count: typeof list.contact_count === 'number' ? list.contact_count : 0,
        created_at: list.created_at,
        updated_at: list.updated_at,
        is_member: Boolean(list.is_member),
        tags: Array.isArray(list.tags) ? list.tags : [],
      }))

      setContactLists(normalizedLists)
      setListPagination(payload.pagination ?? { page: listPage, limit: 10, hasNextPage: false, hasPrevPage: listPage > 1 })
    } catch (error) {
      console.error('Failed to fetch contact lists:', error)
      setContactLists([])
      setListPagination({ page: listPage, limit: 10, hasNextPage: false, hasPrevPage: listPage > 1 })
    } finally {
      setListsLoading(false)
    }
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4" />
      case 'paused': return <Pause className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'draft': return <Settings className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getContactStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'bounced': return 'bg-red-100 text-red-800'
      case 'unsubscribed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—'
    const parsed = new Date(dateString)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '0.0%'
    }
    return `${value.toFixed(1)}%`
  }

  const handleAddToList = async (listId: string) => {
    try {
      // TODO: Implement API call to add contact to list
      console.log('Adding contact to list:', listId)

      // Update local state
      setContactLists(prev =>
        prev.map(list =>
          list.id === listId
            ? { ...list, is_member: true, contact_count: list.contact_count + 1 }
            : list
        )
      )
    } catch (error) {
      console.error('Failed to add contact to list:', error)
    }
  }

  const handleRemoveFromList = async (listId: string) => {
    try {
      // TODO: Implement API call to remove contact from list
      console.log('Removing contact from list:', listId)

      // Update local state
      setContactLists(prev =>
        prev.map(list =>
          list.id === listId
            ? { ...list, is_member: false, contact_count: Math.max(0, list.contact_count - 1) }
            : list
        )
      )
    } catch (error) {
      console.error('Failed to remove contact from list:', error)
    }
  }

  const handleAddToCampaign = (campaignId: string) => {
    // TODO: Implement add to campaign functionality
    console.log('Adding contact to campaign:', campaignId)
  }

  if (campaignsLoading && listsLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading campaigns and lists...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'campaigns'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Campaigns</span>
        </button>

        <button
          onClick={() => setActiveTab('lists')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'lists'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Lists</span>
        </button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {activeTab === 'campaigns' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'campaigns' ? (
        /* Campaigns Tab */
        <div className="space-y-4">
          {campaignsLoading ? (
            <div className="text-center py-10 text-gray-500">Loading campaigns...</div>
          ) : campaigns.length > 0 ? (
            campaigns.map((campaign) => {
              const sentEmails = campaign.emails_sent || 0
              const openRate = campaign.open_rate ?? (sentEmails > 0 ? (campaign.emails_opened / sentEmails) * 100 : 0)
              const clickRate = campaign.click_rate ?? (sentEmails > 0 ? (campaign.emails_clicked / sentEmails) * 100 : 0)
              const replyRate = campaign.reply_rate ?? (sentEmails > 0 ? (campaign.emails_replied / sentEmails) * 100 : 0)
              const joinedDate = campaign.joined_at || campaign.campaign_created_at

              return (
                <Card key={campaign.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {campaign.name}
                          </h3>
                          {campaign.status && (
                            <Badge className={`${getStatusColor(campaign.status)} border-0 flex items-center space-x-1`}>
                              {getStatusIcon(campaign.status)}
                              <span className="capitalize">{campaign.status}</span>
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                          {campaign.total_contacts !== null && campaign.total_contacts !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{campaign.total_contacts} contacts</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Mail className="h-4 w-4" />
                            <span>{sentEmails} emails sent</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Joined {formatDate(joinedDate)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">
                              {formatPercentage(openRate)}
                            </div>
                            <div className="text-xs text-gray-600">Open Rate</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">
                              {formatPercentage(clickRate)}
                            </div>
                            <div className="text-xs text-gray-600">Click Rate</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">
                              {formatPercentage(replyRate)}
                            </div>
                            <div className="text-xs text-gray-600">Reply Rate</div>
                          </div>
                        </div>

                        {campaign.contact_status && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Contact Status:</span>
                            <Badge className={`${getContactStatusColor(campaign.contact_status)} border-0 text-xs`}>
                              {campaign.contact_status}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-4 md:mt-0 md:ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center space-x-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>View</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAddToCampaign(campaign.id)}>
                              Add to Different Step
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              View Contact Journey
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Remove from Campaign
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaigns Found</h3>
                <p className="text-gray-600 mb-6">
                  This contact is not currently part of any campaigns.
                </p>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add to Campaign</span>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!campaignPagination.hasPrevPage || campaignsLoading}
              onClick={() => setCampaignPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">Page {campaignPagination.page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!campaignPagination.hasNextPage || campaignsLoading}
              onClick={() => setCampaignPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        /* Lists Tab */
        <div className="space-y-4">
          {listsLoading ? (
            <div className="text-center py-10 text-gray-500">Loading lists...</div>
          ) : contactLists.length > 0 ? (
            contactLists.map((list) => (
              <Card key={list.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {list.name}
                        </h3>
                        {list.is_member && (
                          <Badge className="bg-green-100 text-green-800 border-0 flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>Member</span>
                          </Badge>
                        )}
                      </div>

                      {list.description && (
                        <p className="text-sm text-gray-600 mb-3">{list.description}</p>
                      )}

                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{list.contact_count.toLocaleString()} contacts</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Updated {formatDate(list.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {list.is_member ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFromList(list.id)}
                          className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Remove</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddToList(list.id)}
                          className="flex items-center space-x-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add to List</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Lists Found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ? 'No lists match your search.' : 'No contact lists available.'}
                </p>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Create List</span>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!listPagination.hasPrevPage || listsLoading}
              onClick={() => setListPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">Page {listPagination.page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!listPagination.hasNextPage || listsLoading}
              onClick={() => setListPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
