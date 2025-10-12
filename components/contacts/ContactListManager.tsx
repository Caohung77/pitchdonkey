'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Heart,
  List
} from 'lucide-react'
import { ApiClient } from '@/lib/api-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateContactListModal } from './CreateContactListModal'
import { EditContactListModal } from './EditContactListModal'
import { ViewContactListModal } from './ViewContactListModal'
import { ContactListDetailView } from './ContactListDetailView'
import { useToast } from '@/components/ui/toast'

interface ContactList {
  id: string
  name: string
  description: string
  contact_ids?: string[]
  contactCount: number
  tags: string[]
  isFavorite: boolean
  createdAt: string
  created_at: string
  updated_at: string
  type: 'list'
}

interface ContactListManagerProps {
  userId: string
}

export function ContactListManager({ userId }: ContactListManagerProps) {
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingList, setEditingList] = useState<ContactList | null>(null)
  const [viewingList, setViewingList] = useState<ContactList | null>(null)
  const [detailViewList, setDetailViewList] = useState<ContactList | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetchLists()
  }, [])

  const fetchLists = async () => {
    try {
      setLoading(true)
      const result = await ApiClient.get('/api/contacts/lists')
      const data = result.data || result // Handle both new and old response formats
      if (Array.isArray(data)) {
        setLists(data)
      }
    } catch (error) {
      console.error('Error fetching contact lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleListCreated = (newList: ContactList) => {
    setLists(prev => [newList, ...prev])
  }

  const handleDeleteList = async (list: ContactList) => {
    if (!confirm('Are you sure you want to delete this contact list? This action cannot be undone.')) {
      return
    }

    try {
      await ApiClient.delete(`/api/contacts/lists/${list.id}`)
      setLists(prev => prev.filter(l => l.id !== list.id))

      if (editingList?.id === list.id) {
        setEditingList(null)
      }
      if (viewingList?.id === list.id) {
        setViewingList(null)
      }
      if (detailViewList?.id === list.id) {
        setDetailViewList(null)
      }

      addToast({
        type: 'success',
        title: 'List deleted',
        message: `"${list.name}" has been deleted.`
      })
    } catch (error: any) {
      console.error('Error deleting contact list:', error)
      addToast({
        type: 'error',
        title: 'Could not delete list',
        message: error?.message || 'Something went wrong while deleting the list.'
      })
    }
  }

  const handleToggleFavorite = async (listId: string, currentFavorite: boolean) => {
    try {
      const list = lists.find(l => l.id === listId)
      if (!list) return

      await ApiClient.put(`/api/contacts/lists/${listId}`, {
        ...list,
        isFavorite: !currentFavorite
      })

      setLists(prev => prev.map(l => 
        l.id === listId ? { ...l, isFavorite: !currentFavorite } : l
      ))
    } catch (error) {
      console.error('Error updating favorite status:', error)
      alert(`Failed to update favorite status: ${error.message || 'Please try again.'}`)
    }
  }

  const handleEditList = (list: ContactList) => {
    setEditingList(list)
  }

  const handleViewList = (list: ContactList) => {
    setViewingList(list)
  }

  const handleOpenDetailView = (list: ContactList) => {
    setDetailViewList(list)
  }

  const handleListUpdated = (updatedList: ContactList) => {
    const contactCount = Array.isArray((updatedList as any).contact_ids)
      ? (updatedList as any).contact_ids.length
      : (updatedList as any).contactCount || 0
    setLists(prev => prev.map(l => 
      l.id === updatedList.id ? { ...updatedList, contactCount } as any : l
    ))
    setEditingList(null)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If viewing detail view, render that instead
  if (detailViewList) {
    return (
      <ContactListDetailView
        list={detailViewList}
        onBack={() => setDetailViewList(null)}
        onListUpdated={(updatedList) => {
          setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l))
          setDetailViewList(updatedList)
        }}
        onListDeleted={(listId) => {
          setLists(prev => prev.filter(l => l.id !== listId))
          setDetailViewList(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contact Lists</h2>
          <p className="text-gray-600 text-sm">Static collections of specific contacts</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create List
        </Button>
      </div>

      {lists.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleOpenDetailView(list)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-base">{list.name}</CardTitle>
                      {list.isFavorite && (
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                      )}
                    </div>
                    {list.description && (
                      <CardDescription className="mt-1">
                        {list.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onSelect={(event) => {
                          event.stopPropagation()
                          handleEditList(list)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit List
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={(event) => {
                          event.stopPropagation()
                          handleToggleFavorite(list.id, list.isFavorite)
                        }}
                      >
                        <Heart className="h-4 w-4 mr-2" />
                        {list.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={(event) => {
                          event.stopPropagation()
                          handleViewList(list)
                        }}
                      >
                        <List className="h-4 w-4 mr-2" />
                        View Contacts
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onSelect={(event) => {
                          event.stopPropagation()
                          handleDeleteList(list)
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{(list.contactCount || 0).toLocaleString()} contacts</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {list.tags.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{list.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <List className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contact lists yet</h3>
            <p className="text-gray-600 text-center mb-6">
              Create your first contact list to organize specific contacts for targeted campaigns
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateContactListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onListCreated={handleListCreated}
      />

      <EditContactListModal
        list={editingList}
        isOpen={!!editingList}
        onClose={() => setEditingList(null)}
        onListUpdated={handleListUpdated}
      />

      <ViewContactListModal
        list={viewingList}
        isOpen={!!viewingList}
        onClose={() => setViewingList(null)}
      />
    </div>
  )
}
