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
  Filter
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateSegmentModal } from './CreateSegmentModal'

interface ContactSegment {
  id: string
  name: string
  description: string
  contactCount: number
  createdAt?: string
}

interface SegmentManagerProps {
  userId: string
}

export function SegmentManager({ userId }: SegmentManagerProps) {
  const [segments, setSegments] = useState<ContactSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchSegments()
  }, [])

  const fetchSegments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contacts/segments')
      
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setSegments(data)
        }
      }
    } catch (error) {
      console.error('Error fetching segments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSegmentCreated = (newSegment: ContactSegment) => {
    setSegments(prev => [...prev, newSegment])
  }

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/contacts/segments/${segmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSegments(prev => prev.filter(s => s.id !== segmentId))
      }
    } catch (error) {
      console.error('Error deleting segment:', error)
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contact Segments</h2>
          <p className="text-gray-600 text-sm">Organize your contacts into targeted groups</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Segment
        </Button>
      </div>

      {segments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Card key={segment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{segment.name}</CardTitle>
                    {segment.description && (
                      <CardDescription className="mt-1">
                        {segment.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Segment
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Filter className="h-4 w-4 mr-2" />
                        View Contacts
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteSegment(segment.id)}
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
                    <span>{segment.contactCount.toLocaleString()} contacts</span>
                  </div>
                  <Badge variant="secondary">
                    {segment.id === 'all-contacts' ? 'Default' : 'Custom'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No segments yet</h3>
            <p className="text-gray-600 text-center mb-6">
              Create your first contact segment to organize your contacts for targeted campaigns
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Segment
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateSegmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSegmentCreated={handleSegmentCreated}
      />
    </div>
  )
}