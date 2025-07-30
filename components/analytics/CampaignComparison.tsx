'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Eye,
  MousePointer,
  Reply,
  Mail
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  sent: number
  openRate: number
  clickRate: number
  replyRate: number
  lastActivity: string
}

interface CampaignComparisonProps {
  campaigns: Campaign[]
  selectedCampaigns: string[]
  onSelectionChange: (selected: string[]) => void
  maxComparisons?: number
}

export function CampaignComparison({ 
  campaigns, 
  selectedCampaigns, 
  onSelectionChange,
  maxComparisons = 5
}: CampaignComparisonProps) {
  const [sortBy, setSortBy] = useState<'name' | 'sent' | 'openRate' | 'clickRate' | 'replyRate'>('openRate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

  const handleCampaignSelect = (campaignId: string, checked: boolean) => {
    if (checked) {
      if (selectedCampaigns.length < maxComparisons) {
        onSelectionChange([...selectedCampaigns, campaignId])
      }
    } else {
      onSelectionChange(selectedCampaigns.filter(id => id !== campaignId))
    }
  }

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = (bValue as string).toLowerCase()
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'paused':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return <Minus className="h-4 w-4 text-gray-400" />
    return sortOrder === 'asc' 
      ? <TrendingUp className="h-4 w-4 text-blue-500" />
      : <TrendingDown className="h-4 w-4 text-blue-500" />
  }

  const getPerformanceColor = (value: number, metric: 'openRate' | 'clickRate' | 'replyRate') => {
    const thresholds = {
      openRate: { good: 0.25, average: 0.15 },
      clickRate: { good: 0.05, average: 0.02 },
      replyRate: { good: 0.02, average: 0.01 }
    }

    const threshold = thresholds[metric]
    if (value >= threshold.good) return 'text-green-600 bg-green-50'
    if (value >= threshold.average) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  if (viewMode === 'chart' && selectedCampaigns.length > 0) {
    const selectedCampaignData = campaigns.filter(c => selectedCampaigns.includes(c.id))
    const maxValue = Math.max(...selectedCampaignData.flatMap(c => [c.openRate, c.clickRate, c.replyRate]))

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Campaign Comparison Chart</h4>
          <Button variant="outline" size="sm" onClick={() => setViewMode('table')}>
            Back to Table
          </Button>
        </div>

        <div className="space-y-6">
          {selectedCampaignData.map((campaign, index) => (
            <div key={campaign.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-medium">{campaign.name}</h5>
                <Badge variant={getStatusBadgeVariant(campaign.status)}>
                  {campaign.status}
                </Badge>
              </div>

              <div className="space-y-2">
                {/* Open Rate Bar */}
                <div className="flex items-center space-x-3">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Open Rate</span>
                      <span className="font-medium">{formatPercentage(campaign.openRate)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.openRate / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Click Rate Bar */}
                <div className="flex items-center space-x-3">
                  <MousePointer className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Click Rate</span>
                      <span className="font-medium">{formatPercentage(campaign.clickRate)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.clickRate / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Reply Rate Bar */}
                <div className="flex items-center space-x-3">
                  <Reply className="h-4 w-4 text-purple-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Reply Rate</span>
                      <span className="font-medium">{formatPercentage(campaign.replyRate)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.replyRate / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {selectedCampaigns.length} of {maxComparisons} selected
          </span>
          {selectedCampaigns.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setViewMode('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart View
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={selectedCampaigns.length === 0}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">
                <div className="flex items-center space-x-2">
                  <span>Select</span>
                </div>
              </th>
              <th className="text-left p-3">
                <button 
                  className="flex items-center space-x-1 hover:text-blue-600"
                  onClick={() => handleSort('name')}
                >
                  <span>Campaign</span>
                  {getSortIcon('name')}
                </button>
              </th>
              <th className="text-left p-3">
                <button 
                  className="flex items-center space-x-1 hover:text-blue-600"
                  onClick={() => handleSort('sent')}
                >
                  <Mail className="h-4 w-4" />
                  <span>Sent</span>
                  {getSortIcon('sent')}
                </button>
              </th>
              <th className="text-left p-3">
                <button 
                  className="flex items-center space-x-1 hover:text-blue-600"
                  onClick={() => handleSort('openRate')}
                >
                  <Eye className="h-4 w-4" />
                  <span>Open Rate</span>
                  {getSortIcon('openRate')}
                </button>
              </th>
              <th className="text-left p-3">
                <button 
                  className="flex items-center space-x-1 hover:text-blue-600"
                  onClick={() => handleSort('clickRate')}
                >
                  <MousePointer className="h-4 w-4" />
                  <span>Click Rate</span>
                  {getSortIcon('clickRate')}
                </button>
              </th>
              <th className="text-left p-3">
                <button 
                  className="flex items-center space-x-1 hover:text-blue-600"
                  onClick={() => handleSort('replyRate')}
                >
                  <Reply className="h-4 w-4" />
                  <span>Reply Rate</span>
                  {getSortIcon('replyRate')}
                </button>
              </th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.map((campaign) => (
              <tr 
                key={campaign.id} 
                className={`border-b hover:bg-gray-50 transition-colors ${
                  selectedCampaigns.includes(campaign.id) ? 'bg-blue-50' : ''
                }`}
              >
                <td className="p-3">
                  <Checkbox
                    checked={selectedCampaigns.includes(campaign.id)}
                    onCheckedChange={(checked) => 
                      handleCampaignSelect(campaign.id, checked as boolean)
                    }
                    disabled={
                      !selectedCampaigns.includes(campaign.id) && 
                      selectedCampaigns.length >= maxComparisons
                    }
                  />
                </td>
                <td className="p-3">
                  <div>
                    <div className="font-medium">{campaign.name}</div>
                    <div className="text-sm text-gray-500">
                      Last activity: {new Date(campaign.lastActivity).toLocaleDateString()}
                    </div>
                  </div>
                </td>
                <td className="p-3 font-medium">
                  {formatNumber(campaign.sent)}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getPerformanceColor(campaign.openRate, 'openRate')}`}>
                    {formatPercentage(campaign.openRate)}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getPerformanceColor(campaign.clickRate, 'clickRate')}`}>
                    {formatPercentage(campaign.clickRate)}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getPerformanceColor(campaign.replyRate, 'replyRate')}`}>
                    {formatPercentage(campaign.replyRate)}
                  </span>
                </td>
                <td className="p-3">
                  <Badge variant={getStatusBadgeVariant(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No campaigns found
        </div>
      )}
    </div>
  )
}