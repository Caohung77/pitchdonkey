'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ApiClient } from '@/lib/api-client'
import { 
  X, 
  Save,
  Users
} from 'lucide-react'

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

interface EditContactListModalProps {
  list: ContactList | null
  isOpen: boolean
  onClose: () => void
  onListUpdated: (list: ContactList) => void
}

export function EditContactListModal({ list, isOpen, onClose, onListUpdated }: EditContactListModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: [] as string[]
  })
  const [loading, setLoading] = useState(false)
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    if (list) {
      setFormData({
        name: list.name,
        description: list.description,
        tags: list.tags || []
      })
    }
  }, [list])

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!list || !formData.name.trim()) {
      return
    }

    try {
      setLoading(true)
      
      const updatedList = await ApiClient.put(`/api/contacts/lists/${list.id}`, {
        name: formData.name,
        description: formData.description,
        tags: formData.tags
      })

      // Handle different response formats
      const listData = updatedList.success ? updatedList.data : updatedList
      
      onListUpdated({
        ...list,
        name: formData.name,
        description: formData.description,
        tags: formData.tags,
        ...listData
      })
      
      onClose()
    } catch (error) {
      console.error('Error updating list:', error)
      alert(`Failed to update list: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !list) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Edit Contact List</h2>
            <p className="text-gray-600 text-sm mt-1">
              Update your list information and settings
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">List Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., VIP Customers"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Brief description of this list..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(tag => (
                <span 
                  key={tag} 
                  className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-gray-600 mr-2" />
              <div>
                <h4 className="font-medium text-gray-900">Contact Count</h4>
                <p className="text-sm text-gray-600">
                  This list contains {list.contactCount} contacts
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}