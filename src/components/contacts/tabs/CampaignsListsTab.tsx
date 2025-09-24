'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Target,
  Users,
  Mail,
  Calendar,
  Activity,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Play,
  Pause,
  Settings,
  TrendingUp,
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
  status: 'draft' | 'active' | 'paused' | 'completed'
  type: 'sequence' | 'broadcast'
  total_contacts: number
  sent_count: number
  open_rate: number
  click_rate: number
  reply_rate: number
  created_at: string
  last_activity: string
  contact_status?: 'pending' | 'active' | 'completed' | 'bounced' | 'unsubscribed'
}

interface ContactList {
  id: string
  name: string
  description?: string
  contact_count: number
  created_at: string
  updated_at: string
  is_member?: boolean
}

interface CampaignsListsTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function CampaignsListsTab({ contact, onContactUpdate }: CampaignsListsTabProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'lists'>('campaigns')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'

  useEffect(() => {
    fetchCampaignsAndLists()
  }, [contact.id])

  const fetchCampaignsAndLists = async () => {
    setLoading(true)
    try {
      // TODO: Implement API calls to fetch actual data

      // Mock campaign data
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'Welcome Series - New Leads',
          status: 'active',
          type: 'sequence',
          total_contacts: 245,
          sent_count: 3,
          open_rate: 45.2,
          click_rate: 12.8,
          reply_rate: 3.5,
          created_at: '2024-01-10T10:00:00Z',
          last_activity: '2024-01-15T14:30:00Z',
          contact_status: 'active'
        },
        {
          id: '2',
          name: 'Product Demo Follow-up',
          status: 'completed',
          type: 'sequence',
          total_contacts: 89,
          sent_count: 5,
          open_rate: 62.3,
          click_rate: 24.1,
          reply_rate: 8.9,
          created_at: '2024-01-05T09:00:00Z',
          last_activity: '2024-01-12T16:45:00Z',
          contact_status: 'completed'
        },
        {
          id: '3',
          name: 'Q1 Product Updates',
          status: 'paused',
          type: 'broadcast',
          total_contacts: 1250,
          sent_count: 1,
          open_rate: 38.7,
          click_rate: 8.4,
          reply_rate: 1.2,
          created_at: '2024-01-01T12:00:00Z',
          last_activity: '2024-01-08T10:15:00Z',
          contact_status: 'pending'
        }
      ]

      // Mock contact lists data
      const mockLists: ContactList[] = [
        {
          id: '1',
          name: 'Marketing Directors',
          description: 'Senior marketing professionals in B2B companies',
          contact_count: 324,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-15T16:30:00Z',
          is_member: true
        },
        {
          id: '2',
          name: 'Demo Prospects',
          description: 'Contacts who have requested product demos',
          contact_count: 156,
          created_at: '2024-01-05T14:00:00Z',
          updated_at: '2024-01-14T11:20:00Z',
          is_member: true
        },
        {
          id: '3',
          name: 'Enterprise Leads',
          description: 'High-value enterprise prospects',
          contact_count: 89,
          created_at: '2024-01-10T09:00:00Z',
          updated_at: '2024-01-13T15:45:00Z',
          is_member: false
        },
        {
          id: '4',
          name: 'Re-engagement Campaign',
          description: 'Inactive contacts for re-engagement efforts',
          contact_count: 445,
          created_at: '2023-12-15T10:00:00Z',
          updated_at: '2024-01-10T12:30:00Z',
          is_member: false
        }
      ]

      setCampaigns(mockCampaigns)
      setContactLists(mockLists)
    } catch (error) {
      console.error('Failed to fetch campaigns and lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredLists = contactLists.filter(list =>
    list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (list.description && list.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
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
          <span>Campaigns ({campaigns.length})</span>
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
          <span>Lists ({contactLists.filter(list => list.is_member).length}/{contactLists.length})</span>
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
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'campaigns' ? (
        /* Campaigns Tab */
        <div className="space-y-4">
          {filteredCampaigns.length > 0 ? (
            filteredCampaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campaign.name}
                        </h3>
                        <Badge className={`${getStatusColor(campaign.status)} border-0 flex items-center space-x-1`}>
                          {getStatusIcon(campaign.status)}
                          <span className="capitalize">{campaign.status}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {campaign.type}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{campaign.total_contacts} contacts</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Mail className="h-4 w-4" />
                          <span>{campaign.sent_count} emails sent</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Created {formatDate(campaign.created_at)}</span>
                        </div>
                      </div>

                      {/* Campaign Performance */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900">
                            {campaign.open_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">Open Rate</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900">
                            {campaign.click_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">Click Rate</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900">
                            {campaign.reply_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">Reply Rate</div>
                        </div>
                      </div>

                      {/* Contact Status in Campaign */}
                      {campaign.contact_status && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Contact Status:</span>
                          <Badge className={`${getContactStatusColor(campaign.contact_status)} border-0 text-xs`}>
                            {campaign.contact_status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
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
            ))
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
        </div>
      ) : (
        /* Lists Tab */
        <div className="space-y-4">
          {filteredLists.length > 0 ? (
            filteredLists.map((list) => (
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
        </div>
      )}
    </div>
  )
}