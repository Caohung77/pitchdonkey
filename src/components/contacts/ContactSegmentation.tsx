'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Target, 
  Search, 
  Filter, 
  Users, 
  TrendingUp, 
  Layers,
  Edit,
  Trash2,
  MoreHorizontal,
  Loader2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ContactSegmentationProps {
  onSegmentSelect?: (segment: any) => void
  selectedSegmentId?: string
}

export function ContactSegmentation({ 
  onSegmentSelect, 
  selectedSegmentId 
}: ContactSegmentationProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Mock data
  const stats = {
    total_segments: 8,
    dynamic_segments: 5,
    static_segments: 3,
    largest_segment: {
      name: 'Enterprise Prospects',
      count: 1247
    }
  }

  const segments = [
    {
      id: '1',
      name: 'Enterprise Prospects',
      description: 'Companies with 500+ employees',
      is_dynamic: true,
      contact_count: 1247,
      conditions: [],
      logic: 'AND',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T15:30:00Z'
    },
    {
      id: '2',
      name: 'Tech Startups',
      description: 'Technology companies founded in last 3 years',
      is_dynamic: true,
      contact_count: 892,
      conditions: [],
      logic: 'AND',
      created_at: '2024-01-10T09:00:00Z',
      updated_at: '2024-01-18T11:20:00Z'
    }
  ]

  const templates = [
    {
      name: 'High-Value Prospects',
      description: 'Companies with revenue > $10M'
    },
    {
      name: 'Recent Signups',
      description: 'Contacts added in last 30 days'
    }
  ]

  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateFromTemplate = (template: any) => {
    console.log('Creating segment from template:', template)
    // Implementation would go here
  }

  const handleDeleteSegment = (segmentId: string) => {
    console.log('Deleting segment:', segmentId)
    // Implementation would go here
  }

  const formatConditionSummary = (conditions: any[], logic: string) => {
    if (!conditions || conditions.length === 0) {
      return 'No conditions set'
    }
    return `${conditions.length} condition${conditions.length > 1 ? 's' : ''} (${logic})`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contact Segments</h2>
          <p className="text-gray-600">Organize and target your contacts with smart segments</p>
        </div>
        
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Quick Segments</DropdownMenuLabel>
              {templates.map((template, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleCreateFromTemplate(template)}
                  className="flex-col items-start"
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.description}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Segment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">Total Segments</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total_segments}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">Dynamic</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.dynamic_segments}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium">Static</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.static_segments}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium">Largest Segment</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.largest_segment.count}</p>
          <p className="text-xs text-gray-500 truncate">{stats.largest_segment.name}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search segments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md"
        />
      </div>

      {/* Segments List */}
      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading segments...</p>
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No segments found' : 'No segments created yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Create your first segment to organize and target your contacts'
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Segment
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSegments.map(segment => (
            <Card 
              key={segment.id} 
              className={`cursor-pointer transition-colors ${
                selectedSegmentId === segment.id 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onSegmentSelect?.(segment)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <CardTitle className="text-lg">{segment.name}</CardTitle>
                      <Badge variant={segment.is_dynamic ? "default" : "secondary"}>
                        {segment.is_dynamic ? 'Dynamic' : 'Static'}
                      </Badge>
                      <Badge variant="outline">
                        {segment.contact_count} contacts
                      </Badge>
                    </div>
                    {segment.description && (
                      <p className="text-sm text-gray-600 mb-2">{segment.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {formatConditionSummary(segment.conditions, segment.logic)}
                    </p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSegment(segment.id)
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
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Created {new Date(segment.created_at).toLocaleDateString()}</span>
                  <span>Updated {new Date(segment.updated_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}