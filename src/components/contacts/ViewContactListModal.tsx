'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ApiClient } from '@/lib/api-client'
import { 
  X, 
  Users,
  Mail,
  Building,
  Search,
  RefreshCw
} from 'lucide-react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  company: string
  position: string
  status?: string
}

interface ContactList {
  id: string
  name: string
  description: string
  contactCount: number
  tags: string[]
  isFavorite: boolean
  createdAt: string
  type: 'list'
}

interface ViewContactListModalProps {
  list: ContactList | null
  isOpen: boolean
  onClose: () => void
}

export function ViewContactListModal({ list, isOpen, onClose }: ViewContactListModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (list && isOpen) {
      fetchContacts()
    }
  }, [list, isOpen])

  const fetchContacts = async () => {
    if (!list) return

    try {
      setLoading(true)
      // Use the dedicated contacts endpoint for this list
      const response = await ApiClient.get(`/api/contacts/lists/${list.id}/contacts`)

      // Handle the response data
      if (response.success) {
        setContacts(response.data || [])
      } else if (Array.isArray(response)) {
        // Handle case where response is directly an array
        setContacts(response)
      } else {
        console.warn('Unexpected response format:', response)
        setContacts([])
      }
    } catch (error) {
      console.error('Error fetching contacts for list:', error)
      // Show user-friendly error instead of empty list
      if (error?.response?.status === 500) {
        console.error('Server error when fetching contacts for list', list.id, error)
      }
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      contact.first_name.toLowerCase().includes(searchLower) ||
      contact.last_name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.company.toLowerCase().includes(searchLower) ||
      contact.position.toLowerCase().includes(searchLower)
    )
  })

  if (!isOpen || !list) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {list.name}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {list.description || 'View and manage contacts in this list'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {/* List Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">Contact List Details</h3>
                  <p className="text-sm text-gray-600">
                    {loading ? 'Loading contacts...' : `${contacts.length} contacts`} • Created {new Date(list.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchContacts} 
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {list.tags && list.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {list.tags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Contacts List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading contacts...</span>
            </div>
          ) : filteredContacts.length > 0 ? (
            <div className="grid gap-4">
              {filteredContacts.map((contact) => (
                <Card key={contact.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-100 p-2 rounded-full">
                          <Users className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </h4>
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            {contact.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-sm font-medium">
                          <Building className="h-3 w-3 mr-1" />
                          {contact.company || 'N/A'}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {contact.position || 'No position'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts in this list</h3>
              <p className="text-gray-600">
                This list doesn't contain any contacts yet. Add contacts to get started.
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
              <p className="text-gray-600">
                No contacts match your search criteria. Try a different search term.
              </p>
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600">
              Showing {filteredContacts.length} of {contacts.length} contacts
            </p>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}