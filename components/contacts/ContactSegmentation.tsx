'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Filter, 
  Users, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Loader2,
  Target,
  TrendingUp,
  Layers,
  Search
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'

interface SegmentRule {
  field: string
  operator: string
  value: string | string[] | number
}

interface SegmentCondition {
  rules: SegmentRule[]
  logic: 'AND' | 'OR'
}

interface ContactSegment {
  id: string
  name: string
  description?: string
  conditions: SegmentCondition[]
  logic: 'AND' | 'OR'
  contact_count: number
  is_dynamic: boolean
  created_at: string
  updated_at: string
}

interface SegmentStats {
  total_segments: number
  dynamic_segments: number
  static_segments: number
  largest_segment: {
    name: string
    count: number
  }
  most_used_fields: Array<{
    field: string
    usage_count: number
  }>
}

interface SegmentTemplate {
  name: string
  description: string
  conditions: SegmentCondition[]
  logic: 'AND' | 'OR'
}

interface ContactSegmentationProps {
  onSegmentSelect?: (segment: ContactSegment) => void
  selectedSegmentId?: string
}

export function ContactSegmentation({ onSegmentSelect, selectedSegmentId }: ContactSegmentationProps) {
  const [segments, setSegments] = useState<ContactSegment[]>([])
  const [stats, setStats] = useState<SegmentStats | null>(null)
  const [templates, setTemplates] = useState<SegmentTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<ContactSegment | null>(null)

  useEffect(() => {
    loadSegments()
    loadStats()
    loadTemplates()
  }, [])

  const loadSegments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/contacts/segments?include_count=true')
      const data = await response.json()
      
      if (data.success) {
        setSegments(data.data)
      }
    } catch (error) {
      console.error('Error loading segments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/contacts/segments/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading segment stats:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/contacts/segments/templates')
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.data)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleCreateSegment = async (segmentData: any) => {
    try {
      const response = await fetch('/api/contacts/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segmentData)
      })

      if (response.ok) {
        loadSegments()
        loadStats()
        setIsCreateDialogOpen(false)
      }
    } catch (error) {
      console.error('Error creating segment:', error)
      throw error
    }
  }

  const handleUpdateSegment = async (segmentData: any) => {
    if (!editingSegment) return

    try {
      const response = await fetch(`/api/contacts/segments/${editingSegment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segmentData)
      })

      if (response.ok) {
        loadSegments()
        loadStats()
        setEditingSegment(null)
      }
    } catch (error) {
      console.error('Error updating segment:', error)
      throw error
    }
  }

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return

    try {
      const response = await fetch(`/api/contacts/segments/${segmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadSegments()
        loadStats()
      }
    } catch (error) {
      console.error('Error deleting segment:', error)
    }
  }

  const handleCreateFromTemplate = async (template: SegmentTemplate) => {
    const segmentData = {
      name: template.name,
      description: template.description,
      conditions: template.conditions,
      logic: template.logic,
      is_dynamic: true
    }

    await handleCreateSegment(segmentData)
  }

  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatConditionSummary = (conditions: SegmentCondition[], logic: 'AND' | 'OR') => {
    if (conditions.length === 0) return 'No conditions'
    
    const conditionSummaries = conditions.map(condition => {
      const ruleSummaries = condition.rules.map(rule => {
        const fieldLabel = rule.field.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase())
        const operatorLabel = rule.operator.replace('_', ' ')
        const valueStr = Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)
        return `${fieldLabel} ${operatorLabel} ${valueStr}`
      })
      
      return ruleSummaries.length > 1 
        ? `(${ruleSummaries.join(` ${condition.logic} `)})`
        : ruleSummaries[0]
    })

    return conditionSummaries.length > 1
      ? conditionSummaries.join(` ${logic} `)
      : conditionSummaries[0]
  }

  return (
    <div className=\"space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h2 className=\"text-2xl font-bold\">Contact Segments</h2>
          <p className=\"text-gray-600\">Organize and target your contacts with smart segments</p>
        </div>
        
        <div className=\"flex space-x-2\">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant=\"outline\">
                <Target className=\"h-4 w-4 mr-2\" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className=\"w-64\">
              <DropdownMenuLabel>Quick Segments</DropdownMenuLabel>
              {templates.map((template, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleCreateFromTemplate(template)}
                  className=\"flex-col items-start\"
                >
                  <div className=\"font-medium\">{template.name}</div>
                  <div className=\"text-xs text-gray-500\">{template.description}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className=\"h-4 w-4 mr-2\" />
            Create Segment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
          <div className=\"bg-white p-4 rounded-lg border\">
            <div className=\"flex items-center space-x-2\">
              <Layers className=\"h-5 w-5 text-blue-500\" />
              <span className=\"text-sm font-medium\">Total Segments</span>
            </div>
            <p className=\"text-2xl font-bold mt-1\">{stats.total_segments}</p>
          </div>
          
          <div className=\"bg-white p-4 rounded-lg border\">
            <div className=\"flex items-center space-x-2\">
              <TrendingUp className=\"h-5 w-5 text-green-500\" />
              <span className=\"text-sm font-medium\">Dynamic</span>
            </div>
            <p className=\"text-2xl font-bold mt-1\">{stats.dynamic_segments}</p>
          </div>
          
          <div className=\"bg-white p-4 rounded-lg border\">
            <div className=\"flex items-center space-x-2\">
              <Filter className=\"h-5 w-5 text-purple-500\" />
              <span className=\"text-sm font-medium\">Static</span>
            </div>
            <p className=\"text-2xl font-bold mt-1\">{stats.static_segments}</p>
          </div>
          
          <div className=\"bg-white p-4 rounded-lg border\">
            <div className=\"flex items-center space-x-2\">
              <Users className=\"h-5 w-5 text-orange-500\" />
              <span className=\"text-sm font-medium\">Largest Segment</span>
            </div>
            <p className=\"text-2xl font-bold mt-1\">{stats.largest_segment.count}</p>
            <p className=\"text-xs text-gray-500 truncate\">{stats.largest_segment.name}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className=\"relative\">
        <Search className=\"absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400\" />
        <input
          type=\"text\"
          placeholder=\"Search segments...\"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className=\"w-full pl-10 pr-4 py-2 border rounded-md\"
        />
      </div>

      {/* Segments List */}
      {isLoading ? (
        <div className=\"text-center py-8\">
          <Loader2 className=\"h-8 w-8 animate-spin mx-auto mb-4\" />
          <p className=\"text-gray-600\">Loading segments...</p>
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className=\"text-center py-12\">
          <Target className=\"h-12 w-12 text-gray-400 mx-auto mb-4\" />
          <h3 className=\"text-lg font-medium text-gray-900 mb-2\">
            {searchTerm ? 'No segments found' : 'No segments created yet'}
          </h3>
          <p className=\"text-gray-600 mb-4\">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Create your first segment to organize and target your contacts'
            }
          </p>
          {!searchTerm && (
            <div className=\"flex justify-center space-x-2\">
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className=\"h-4 w-4 mr-2\" />
                Create Segment
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant=\"outline\">
                    <Target className=\"h-4 w-4 mr-2\" />
                    Use Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {templates.slice(0, 3).map((template, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => handleCreateFromTemplate(template)}
                    >
                      {template.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      ) : (
        <div className=\"grid gap-4\">
          {filteredSegments.map(segment => (
            <Card 
              key={segment.id} 
              className={`cursor-pointer transition-colors ${\n                selectedSegmentId === segment.id \n                  ? 'ring-2 ring-blue-500 bg-blue-50' \n                  : 'hover:bg-gray-50'\n              }`}\n              onClick={() => onSegmentSelect?.(segment)}\n            >\n              <CardHeader className=\"pb-3\">\n                <div className=\"flex items-start justify-between\">\n                  <div className=\"flex-1\">\n                    <div className=\"flex items-center space-x-3 mb-2\">\n                      <CardTitle className=\"text-lg\">{segment.name}</CardTitle>\n                      <Badge variant={segment.is_dynamic ? \"default\" : \"secondary\"}>\n                        {segment.is_dynamic ? 'Dynamic' : 'Static'}\n                      </Badge>\n                      <Badge variant=\"outline\">\n                        {segment.contact_count} contacts\n                      </Badge>\n                    </div>\n                    {segment.description && (\n                      <p className=\"text-sm text-gray-600 mb-2\">{segment.description}</p>\n                    )}\n                    <p className=\"text-xs text-gray-500\">\n                      {formatConditionSummary(segment.conditions, segment.logic)}\n                    </p>\n                  </div>\n                  \n                  <DropdownMenu>\n                    <DropdownMenuTrigger asChild>\n                      <Button variant=\"ghost\" size=\"sm\" onClick={(e) => e.stopPropagation()}>\n                        <MoreHorizontal className=\"h-4 w-4\" />\n                      </Button>\n                    </DropdownMenuTrigger>\n                    <DropdownMenuContent>\n                      <DropdownMenuItem\n                        onClick={(e) => {\n                          e.stopPropagation()\n                          setEditingSegment(segment)\n                        }}\n                      >\n                        <Edit className=\"h-4 w-4 mr-2\" />\n                        Edit\n                      </DropdownMenuItem>\n                      <DropdownMenuSeparator />\n                      <DropdownMenuItem\n                        onClick={(e) => {\n                          e.stopPropagation()\n                          handleDeleteSegment(segment.id)\n                        }}\n                        className=\"text-red-600\"\n                      >\n                        <Trash2 className=\"h-4 w-4 mr-2\" />\n                        Delete\n                      </DropdownMenuItem>\n                    </DropdownMenuContent>\n                  </DropdownMenu>\n                </div>\n              </CardHeader>\n              \n              <CardContent className=\"pt-0\">\n                <div className=\"flex items-center justify-between text-sm text-gray-500\">\n                  <span>Created {new Date(segment.created_at).toLocaleDateString()}</span>\n                  <span>Updated {new Date(segment.updated_at).toLocaleDateString()}</span>\n                </div>\n              </CardContent>\n            </Card>\n          ))}\n        </div>\n      )}\n\n      {/* Most Used Fields */}\n      {stats && stats.most_used_fields.length > 0 && (\n        <Card>\n          <CardHeader>\n            <CardTitle className=\"text-lg\">Most Used Fields</CardTitle>\n          </CardHeader>\n          <CardContent>\n            <div className=\"flex flex-wrap gap-2\">\n              {stats.most_used_fields.map((field, index) => (\n                <Badge key={index} variant=\"outline\">\n                  {field.field.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase())} ({field.usage_count})\n                </Badge>\n              ))}\n            </div>\n          </CardContent>\n        </Card>\n      )}\n\n      {/* TODO: Add SegmentDialog components for create/edit */}\n      {/* These would be complex components for building segment conditions */}\n    </div>\n  )\n}"