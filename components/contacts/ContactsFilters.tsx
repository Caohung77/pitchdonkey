'use client'

import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ContactsFiltersProps {
  searchTerm: string
  statusFilter: string
  onSearchChange: (search: string) => void
  onStatusFilterChange: (status: string) => void
  onClearFilters: () => void
}

export function ContactsFilters({
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onClearFilters
}: ContactsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm)

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

  const handleClearFilters = () => {
    setLocalSearch('')
    onClearFilters()
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all'

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
          </div>
        )}
      </CardContent>
    </Card>
  )
}