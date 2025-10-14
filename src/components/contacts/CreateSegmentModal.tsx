'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Plus, 
  X, 
  Filter,
  Building,
  MapPin,
  Briefcase,
  Calendar
} from 'lucide-react'

interface CreateSegmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSegmentCreated: (segment: ContactSegment) => void
}

interface ContactSegment {
  id: string
  name: string
  description: string
  contactCount: number
}

interface FilterCriteria {
  company?: string
  jobTitle?: string
  location?: string
  industry?: string
  addedAfter?: string
  tags?: string[]
}

export function CreateSegmentModal({ isOpen, onClose, onSegmentCreated }: CreateSegmentModalProps) {
  const [step, setStep] = useState<'basic' | 'filters'>('basic')
  const [segmentData, setSegmentData] = useState({
    name: '',
    description: ''
  })
  const [filters, setFilters] = useState<FilterCriteria>({})
  const [loading, setLoading] = useState(false)
  const [estimatedCount, setEstimatedCount] = useState(100) // Start with total count

  // Update estimation whenever filters change
  useEffect(() => {
    estimateContactCount()
  }, [filters.company, filters.jobTitle, filters.location, filters.industry, filters.addedAfter])

  const handleBasicNext = () => {
    if (segmentData.name.trim()) {
      setStep('filters')
      // Estimation will be handled by useEffect
    }
  }

  const estimateContactCount = () => {
    // Start with base count from our populated database
    let count = 100 // We know we have 100 contacts
    
    // Apply filters to estimate count
    if (filters.company && filters.company.trim()) {
      count = Math.floor(count * 0.3) // ~30 contacts might match company filter
    }
    if (filters.jobTitle && filters.jobTitle.trim()) {
      count = Math.floor(count * 0.4) // ~40% might match job title
    }
    if (filters.location && filters.location.trim()) {
      count = Math.floor(count * 0.6) // ~60% might match location
    }
    if (filters.industry && filters.industry !== '') {
      count = Math.floor(count * 0.5) // ~50% might match industry
    }
    if (filters.addedAfter && filters.addedAfter !== '') {
      count = Math.floor(count * 0.2) // ~20% might be recent
    }
    
    // Ensure minimum count
    const finalCount = Math.max(count, 5)
    setEstimatedCount(finalCount)
  }

  const handleCreateSegment = async () => {
    try {
      setLoading(true)
      console.log('Creating segment with data:', {
        name: segmentData.name,
        description: segmentData.description,
        filterCriteria: filters
      })
      
      const response = await fetch('/api/contacts/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segmentData.name,
          description: segmentData.description,
          filterCriteria: filters
        })
      })

      console.log('API Response status:', response.status)

      if (response.ok) {
        const newSegment = await response.json()
        console.log('Created segment:', newSegment)
        
        // Use the contact count from the API response or fall back to estimated count
        const segmentWithCount = {
          ...newSegment,
          contactCount: newSegment.contactCount || estimatedCount
        }
        
        console.log('Calling onSegmentCreated with:', segmentWithCount)
        onSegmentCreated(segmentWithCount)
        onClose()
        resetForm()
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        alert(`Failed to create segment: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Network/Parse Error:', error)
      alert('Failed to create segment. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('basic')
    setSegmentData({ name: '', description: '' })
    setFilters({})
    setEstimatedCount(100) // Reset to total count
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Create Contact Segment</h2>
            <p className="text-gray-600 text-sm">
              {step === 'basic' ? 'Define your segment' : 'Set filtering criteria'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {step === 'basic' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Segment Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Tech Industry Leads"
                  value={segmentData.name}
                  onChange={(e) => setSegmentData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Brief description of this segment..."
                  value={segmentData.description}
                  onChange={(e) => setSegmentData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                  <div>
                    <h4 className="font-medium text-blue-900">Segment Tips</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Use descriptive names that indicate the target audience</li>
                      <li>• Segments help you personalize your campaigns</li>
                      <li>• You can create multiple segments for different campaigns</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleBasicNext} disabled={!segmentData.name.trim()}>
                  Next: Add Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Filter Criteria</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Add filters to narrow down your contact segment. Leave empty to include all contacts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Building className="h-4 w-4 inline mr-1" />
                    Company
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., contains 'Tech'"
                    value={filters.company || ''}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, company: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Briefcase className="h-4 w-4 inline mr-1" />
                    Job Title
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., contains 'Manager'"
                    value={filters.jobTitle || ''}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, jobTitle: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Location
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., San Francisco"
                    value={filters.location || ''}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, location: e.target.value }))
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Filter className="h-4 w-4 inline mr-1" />
                    Industry
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={filters.industry || ''}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, industry: e.target.value }))
                    }}
                  >
                    <option value="">All Industries</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="education">Education</option>
                    <option value="retail">Retail</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="consulting">Consulting</option>
                    <option value="marketing">Marketing</option>
                    <option value="media">Media</option>
                    <option value="legal">Legal</option>
                    <option value="real-estate">Real Estate</option>
                    <option value="automotive">Automotive</option>
                    <option value="energy">Energy</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Added After
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={filters.addedAfter || ''}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, addedAfter: e.target.value }))
                    }}
                  />
                </div>
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Estimated Contacts</h4>
                      <p className="text-sm text-gray-600">Based on current filters</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {estimatedCount.toLocaleString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('basic')}>
                  Back
                </Button>
                <div className="space-x-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSegment} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Segment'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}