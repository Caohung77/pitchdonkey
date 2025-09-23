'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FilterTagCloud } from './FilterTagCloud'
import { SortDropdown } from './SortDropdown'

interface EnrichmentStats {
  webEnriched: number
  linkedinEnriched: number
  fullyEnriched: number
  notEnriched: number
  total: number
}

interface EngagementStats {
  not_contacted: number
  pending: number
  engaged: number
  bad: number
  total: number
}

interface ContactsFiltersProps {
  searchTerm: string
  statusFilter: string
  enrichmentFilter?: string | null
  engagementFilter?: string | null
  scoreRange?: [number, number] | null
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  userId: string
  onSearchChange: (search: string) => void
  onStatusFilterChange: (status: string) => void
  onEnrichmentFilterChange?: (filter: string | null) => void
  onEngagementFilterChange?: (filter: string | null) => void
  onScoreRangeChange?: (range: [number, number] | null) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onClearFilters: () => void
}

export function ContactsFilters({
  searchTerm,
  statusFilter,
  enrichmentFilter,
  engagementFilter,
  scoreRange,
  sortBy = 'updated_at',
  sortOrder = 'desc',
  userId,
  onSearchChange,
  onStatusFilterChange,
  onEnrichmentFilterChange,
  onEngagementFilterChange,
  onScoreRangeChange,
  onSortChange,
  onClearFilters
}: ContactsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm)
  const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null)
  const [engagementStats, setEngagementStats] = useState<EngagementStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearchChange(localSearch)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearch(value)
    
    // Real-time search with debouncing
    if (value === '') {
      onSearchChange('')
    }
  }

  // Fetch enrichment statistics
  useEffect(() => {
    const fetchEnrichmentStats = async () => {
      if (!userId) return
      
      setIsLoadingStats(true)
      try {
        const response = await fetch('/api/contacts/stats')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            // Transform the API response to our expected format
            const stats: EnrichmentStats = {
              total: data.data.total || 0,
              webEnriched: data.data.enriched_web || 0,
              linkedinEnriched: data.data.enriched_linkedin || 0, 
              fullyEnriched: data.data.enriched_both || 0,
              notEnriched: data.data.not_enriched || 0
            }
            setEnrichmentStats(stats)
          }
        }
      } catch (error) {
        console.error('Failed to fetch enrichment stats:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }

    fetchEnrichmentStats()
  }, [userId])

  const handleClearFilters = () => {
    setLocalSearch('')
    onClearFilters()
  }

  const handleEnrichmentFilterChange = (filter: string | null) => {
    onEnrichmentFilterChange?.(filter)
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || enrichmentFilter || engagementFilter || scoreRange

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search contacts by name, email, company, tags, phone, website..."
                value={localSearch}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
            </select>
          </div>

          {/* Engagement Filter */}
          {onEngagementFilterChange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Engagement:</span>
              <select
                value={engagementFilter || 'all'}
                onChange={(e) => onEngagementFilterChange(e.target.value === 'all' ? null : e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Engagement</option>
                <option value="not_contacted">🟦 Not Contacted</option>
                <option value="pending">🟡 No Response Yet</option>
                <option value="engaged">🟢 Engaged</option>
                <option value="bad">🔴 Do Not Contact</option>
              </select>
            </div>
          )}

          {/* Sort Dropdown */}
          {onSortChange && (
            <SortDropdown
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Clear</span>
            </Button>
          )}
        </div>

        {/* Enrichment Filter Tag Cloud */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <FilterTagCloud
            onFilterChange={handleEnrichmentFilterChange}
            activeFilter={enrichmentFilter || null}
            enrichmentStats={enrichmentStats || undefined}
          />
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
            <span>Active filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                Search: "{searchTerm}"
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
                Status: {statusFilter}
              </span>
            )}
            {enrichmentFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                Enrichment: {enrichmentFilter}
              </span>
            )}
            {engagementFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800">
                Engagement: {engagementFilter === 'not_contacted' ? '🟦 Not Contacted' :
                              engagementFilter === 'pending' ? '🟡 No Response Yet' :
                              engagementFilter === 'engaged' ? '🟢 Engaged' :
                              engagementFilter === 'bad' ? '🔴 Do Not Contact' : engagementFilter}
              </span>
            )}
            {scoreRange && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                Score: {scoreRange[0]}-{scoreRange[1]}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}