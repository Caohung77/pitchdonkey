'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  Users, 
  Package, 
  Star, 
  MessageSquare,
  Calendar,
  Sparkles
} from 'lucide-react'

interface EnrichmentData {
  company_name: string
  industry: string
  products_services: string[]
  target_audience: string[]
  unique_points: string[]
  tone_style: string
}

interface EnrichmentDisplayProps {
  enrichmentData: EnrichmentData | null
  enrichmentStatus: 'pending' | 'completed' | 'failed' | null
  enrichmentUpdatedAt: string | null
  className?: string
  showHeader?: boolean
}

export function EnrichmentDisplay({
  enrichmentData,
  enrichmentStatus,
  enrichmentUpdatedAt,
  className = '',
  showHeader = true
}: EnrichmentDisplayProps) {
  if (!enrichmentData || enrichmentStatus !== 'completed') {
    return null
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const hasAnyData = 
    enrichmentData.company_name ||
    enrichmentData.industry ||
    enrichmentData.products_services.length > 0 ||
    enrichmentData.target_audience.length > 0 ||
    enrichmentData.unique_points.length > 0 ||
    enrichmentData.tone_style

  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-gray-500 py-4">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No company insights were extracted from the website.</p>
            <p className="text-xs text-gray-400 mt-1">The website may not contain sufficient information.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
              Company Insights
            </CardTitle>
            {enrichmentUpdatedAt && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(enrichmentUpdatedAt)}
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {/* Company Name */}
        {enrichmentData.company_name && (
          <div className="flex items-start space-x-3">
            <Building2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Company</h4>
              <p className="text-sm text-gray-700 mt-1">{enrichmentData.company_name}</p>
            </div>
          </div>
        )}

        {/* Industry */}
        {enrichmentData.industry && (
          <div className="flex items-start space-x-3">
            <Package className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Industry</h4>
              <p className="text-sm text-gray-700 mt-1">{enrichmentData.industry}</p>
            </div>
          </div>
        )}

        {/* Products & Services */}
        {enrichmentData.products_services.length > 0 && (
          <div className="flex items-start space-x-3">
            <Package className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Products & Services</h4>
              <div className="flex flex-wrap gap-1 mt-2">
                {enrichmentData.products_services.map((item, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Target Audience */}
        {enrichmentData.target_audience.length > 0 && (
          <div className="flex items-start space-x-3">
            <Users className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Target Audience</h4>
              <div className="flex flex-wrap gap-1 mt-2">
                {enrichmentData.target_audience.map((item, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Unique Points */}
        {enrichmentData.unique_points.length > 0 && (
          <div className="flex items-start space-x-3">
            <Star className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Unique Points</h4>
              <div className="flex flex-wrap gap-1 mt-2">
                {enrichmentData.unique_points.map((item, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tone & Style */}
        {enrichmentData.tone_style && (
          <div className="flex items-start space-x-3">
            <MessageSquare className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">Communication Style</h4>
              <p className="text-sm text-gray-700 mt-1">{enrichmentData.tone_style}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CompactEnrichmentDisplay({
  enrichmentData,
  enrichmentStatus
}: {
  enrichmentData: EnrichmentData | null
  enrichmentStatus: 'pending' | 'completed' | 'failed' | null
}) {
  if (!enrichmentData || enrichmentStatus !== 'completed') {
    return null
  }

  const hasAnyData = 
    enrichmentData.company_name ||
    enrichmentData.industry ||
    enrichmentData.products_services.length > 0 ||
    enrichmentData.target_audience.length > 0 ||
    enrichmentData.unique_points.length > 0 ||
    enrichmentData.tone_style

  if (!hasAnyData) {
    return null
  }

  return (
    <div className="space-y-2">
      {enrichmentData.industry && (
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {enrichmentData.industry}
          </Badge>
        </div>
      )}
      
      {enrichmentData.products_services.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {enrichmentData.products_services.slice(0, 3).map((item, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {item}
            </Badge>
          ))}
          {enrichmentData.products_services.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{enrichmentData.products_services.length - 3} more
            </Badge>
          )}
        </div>
      )}

      {enrichmentData.tone_style && (
        <div className="text-xs text-gray-600">
          <MessageSquare className="h-3 w-3 inline mr-1" />
          {enrichmentData.tone_style}
        </div>
      )}
    </div>
  )
}