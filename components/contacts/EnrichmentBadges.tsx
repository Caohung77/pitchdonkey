'use client'

import { Badge } from '@/components/ui/badge'
import { Globe, Linkedin, Sparkles, Clock } from 'lucide-react'
import { Contact } from '@/lib/contacts'

interface EnrichmentBadgesProps {
  contact: Contact
  size?: 'sm' | 'md'
}

export function EnrichmentBadges({ contact, size = 'sm' }: EnrichmentBadgesProps) {
  const isWebEnriched = contact.enrichment_status === 'completed'
  const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
  const isWebPending = contact.enrichment_status === 'pending'
  const isLinkedInPending = contact.linkedin_extraction_status === 'pending'
  
  // Don't show anything if no enrichment at all
  if (!isWebEnriched && !isLinkedInEnriched && !isWebPending && !isLinkedInPending) {
    return null
  }

  const badgeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  // Show processing badges first
  if (isWebPending || isLinkedInPending) {
    return (
      <div className="flex gap-1">
        {isWebPending && (
          <Badge 
            variant="secondary" 
            className={`${badgeClasses} bg-orange-100 text-orange-700 border-orange-200 font-medium`}
            title="Web enrichment in progress"
          >
            <Clock className={`${iconSize} mr-1`} />
            Web Processing
          </Badge>
        )}
        {isLinkedInPending && (
          <Badge 
            variant="secondary" 
            className={`${badgeClasses} bg-orange-100 text-orange-700 border-orange-200 font-medium`}
            title="LinkedIn enrichment in progress"
          >
            <Clock className={`${iconSize} mr-1`} />
            LinkedIn Processing
          </Badge>
        )}
      </div>
    )
  }

  // Show completed enrichments
  const badges = []

  // Both enriched - show combined badge
  if (isWebEnriched && isLinkedInEnriched) {
    badges.push(
      <Badge 
        key="both"
        variant="secondary" 
        className={`${badgeClasses} bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border-purple-200 font-medium`}
        title="Both web and LinkedIn enriched"
      >
        <Sparkles className={`${iconSize} mr-1`} />
        Fully Enriched
      </Badge>
    )
  } else {
    // Individual badges
    if (isWebEnriched) {
      badges.push(
        <Badge 
          key="web"
          variant="secondary" 
          className={`${badgeClasses} bg-green-100 text-green-700 border-green-200 font-medium`}
          title="Web enriched with company information"
        >
          <Globe className={`${iconSize} mr-1`} />
          Web Enriched
        </Badge>
      )
    }

    if (isLinkedInEnriched) {
      badges.push(
        <Badge 
          key="linkedin"
          variant="secondary" 
          className={`${badgeClasses} bg-blue-100 text-blue-700 border-blue-200 font-medium`}
          title="LinkedIn enriched with profile data"
        >
          <Linkedin className={`${iconSize} mr-1`} />
          LinkedIn Enriched
        </Badge>
      )
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {badges}
    </div>
  )
}

// Utility function to get enrichment status for filtering
export function getEnrichmentTags(contact: Contact): string[] {
  const tags: string[] = []
  
  const isWebEnriched = contact.enrichment_status === 'completed'
  const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
  
  if (isWebEnriched) tags.push('web-enriched')
  if (isLinkedInEnriched) tags.push('linkedin-enriched')
  if (isWebEnriched && isLinkedInEnriched) tags.push('fully-enriched')
  
  return tags
}

// Utility function to check if contact matches enrichment filter
export function matchesEnrichmentFilter(contact: Contact, filter: string): boolean {
  const isWebEnriched = contact.enrichment_status === 'completed'
  const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
  
  switch (filter) {
    case 'web-enriched':
      return isWebEnriched
    case 'linkedin-enriched':
      return isLinkedInEnriched
    case 'fully-enriched':
      return isWebEnriched && isLinkedInEnriched
    case 'not-enriched':
      return !isWebEnriched && !isLinkedInEnriched
    default:
      return true
  }
}