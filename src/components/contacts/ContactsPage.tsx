'use client'

import React, { useState, useEffect } from 'react'
import { Contact } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Download, 
  Tag,
  Trash2,
  MoreHorizontal,
  Users,
  Mail,
  Building,
  CheckSquare,
  Square
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { ContactCard } from './ContactCard'
import AddContactDialog from './AddContactDialog'
import ContactImportDialog from './ContactImportDialog'

interface ContactStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  by_status: Record<string, number>
  by_tags: Record<string, number>
}

interface FilterOptions {
  search: string
  status: string
  tags: string[]
  emailStatus: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  // Filter states
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    tags: [],
    emailStatus: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Load contacts and stats
  useEffect(() => {
    loadContacts()
    loadStats()
  }, [filters, pagination.page])

  const loadContacts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })

      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.emailStatus !== 'all') params.append('email_status', filters.emailStatus)
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','))

      const response = await fetch(`/api/contacts?${params}`)
      const data = await response.json()

      if (data.success) {
        setContacts(data.data.contacts)
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          pages: data.data.pagination.pages
        }))
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/contacts/stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
        // Extract available tags
        setAvailableTags(Object.keys(data.data.by_tags))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page
  }

  const handleSelectContact = (contactId: string, selected: boolean) => {
    const newSelected = new Set(selectedContacts)
    if (selected) {
      newSelected.add(contactId)
    } else {
      newSelected.delete(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)))
    }
  }

  const handleBulkAction = async (action: string, data?: any) => {
    if (selectedContacts.size === 0) return

    try {
      const response = await fetch('/api/contacts/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_ids: Array.from(selectedContacts),
          action,
          data
        })
      })

      if (response.ok) {
        loadContacts()
        loadStats()
        setSelectedContacts(new Set())
      }
    } catch (error) {
      console.error('Bulk action error:', error)
    }
  }

  const handleAddContact = async (contactData: any) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      })

      if (response.ok) {
        loadContacts()
        loadStats()
      }
    } catch (error) {
      console.error('Error adding contact:', error)
      throw error
    }
  }

  const handleEditContact = async (contactData: any) => {
    if (!editingContact) return

    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      })

      if (response.ok) {
        loadContacts()
        loadStats()
        setEditingContact(null)
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      throw error
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadContacts()
        loadStats()
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const handleExportContacts = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','))

      const response = await fetch(`/api/contacts/export?${params}`)
      const data = await response.json()

      if (data.success) {
        // Convert to CSV and download
        const csv = convertToCSV(data.data)
        downloadCSV(csv, 'contacts.csv')
      }
    } catch (error) {
      console.error('Error exporting contacts:', error)
    }
  }

  const convertToCSV = (contacts: Contact[]) => {
    const headers = [
      'Email', 'First Name', 'Last Name', 'Company', 'Job Title', 
      'Website', 'Phone', 'Tags', 'Status', 'Email Status', 'Created'
    ]
    
    const rows = contacts.map(contact => [
      contact.email,
      contact.first_name,
      contact.last_name,
      contact.company || '',
      contact.position || '',
      contact.website || '',
      contact.phone || '',
      contact.tags.join('; '),
      contact.status,
      new Date(contact.created_at).toLocaleDateString()
    ])

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-gray-600">
            Manage your contact list and organize prospects
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleExportContacts}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Total Contacts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.active}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium">Unsubscribed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.unsubscribed}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Tag className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">Tags</span>
            </div>
            <p className="text-2xl font-bold mt-1">{Object.keys(stats.by_tags).length}</p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>

          {/* Email Status Filter */}
          <select
            value={filters.emailStatus}
            onChange={(e) => handleFilterChange('emailStatus', e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Email Status</option>
            <option value="valid">Valid</option>
            <option value="risky">Risky</option>
            <option value="invalid">Invalid</option>
            <option value="unknown">Unknown</option>
          </select>

          {/* Sort */}
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-')
              handleFilterChange('sortBy', sortBy)
              handleFilterChange('sortOrder', sortOrder)
            }}
            className="px-3 py-2 border rounded-md"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="first_name-asc">Name A-Z</option>
            <option value="first_name-desc">Name Z-A</option>
            <option value="company_name-asc">Company A-Z</option>
          </select>
        </div>

        {/* Tag Filters */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700">Filter by tags:</span>
            {availableTags.map(tag => (
              <Badge
                key={tag}
                variant={filters.tags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newTags = filters.tags.includes(tag)
                    ? filters.tags.filter(t => t !== tag)
                    : [...filters.tags, tag]
                  handleFilterChange('tags', newTags)
                }}
              >
                {tag} ({stats?.by_tags[tag] || 0})
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedContacts.size > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag className="h-4 w-4 mr-2" />
                    Add Tags
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Add Tag</DropdownMenuLabel>
                  {availableTags.map(tag => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => handleBulkAction('add_tags', { tags: [tag] })}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => handleBulkAction('update_status', { status: 'active' })}
                  >
                    Mark as Active
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleBulkAction('update_status', { status: 'unsubscribed' })}
                  >
                    Mark as Unsubscribed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(`Delete ${selectedContacts.size} contacts?`)) {
                        handleBulkAction('update_status', { status: 'deleted' })
                      }
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContacts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Select All */}
      {contacts.length > 0 && (
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAll}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedContacts.size === contacts.length ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span>
              {selectedContacts.size === contacts.length ? 'Deselect All' : 'Select All'}
            </span>
          </button>
        </div>
      )}

      {/* Contacts Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.status !== 'all' || filters.tags.length > 0
              ? 'Try adjusting your filters or search terms'
              : 'Get started by adding your first contact or importing from CSV'
            }
          </p>
          <div className="flex justify-center space-x-2">
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={setEditingContact}
              onDelete={handleDeleteContact}
              onSelect={handleSelectContact}
              onAddTag={(contactId) => {/* TODO: Implement tag functionality */}}
              isSelected={selectedContacts.has(contact.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} contacts
          </p>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            
            <span className="flex items-center px-3 py-1 text-sm">
              Page {pagination.page} of {pagination.pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddContactDialog
        onContactAdded={() => {
          setIsAddDialogOpen(false)
          // Refresh contacts list
          window.location.reload()
        }}
      />

      {/* TODO: Add proper edit dialog */}

      <ContactImportDialog
        onImportComplete={() => {
          // Refresh contacts list
          window.location.reload()
        }}
      />
    </div>
  )
}