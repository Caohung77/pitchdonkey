/**
 * Contact Query Function Definitions for Gemini Function Calling
 *
 * These function definitions are passed to Gemini 2.5 Flash Lite to enable
 * intelligent routing of natural language queries to Supabase database operations.
 */

export interface ContactQueryFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      items?: {
        type: string
        enum?: string[]
      }
      default?: any
      enum?: string[]
    }>
    required?: string[]
  }
}

export const CONTACT_QUERY_FUNCTIONS: ContactQueryFunction[] = [
  {
    name: 'query_contacts_basic',
    description: 'Query contacts with basic profile filters including country, job role/title, company keywords, and tags. Use this for demographic and firmographic filtering. The roles parameter searches the contact\'s position field (job title) using case-insensitive partial matching.',
    parameters: {
      type: 'object',
      properties: {
        countries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by country names (e.g., ["Germany", "United States"])'
        },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by job titles or roles using partial matching (e.g., ["CEO", "CTO", "VP", "Director", "Chief"]). Searches the position field with ILIKE pattern matching, so "CEO" matches "CEO & Founder", "Regional CEO", etc. For decision makers, include: CEO, CTO, CFO, COO, CMO, Chief, VP, SVP, EVP, Director, Head of, President, Owner, Founder, Managing Director.'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Search keywords in company name, position, or custom fields'
        },
        includeTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only include contacts with these tags'
        },
        excludeTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude contacts with these tags'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      }
    }
  },
  {
    name: 'query_contacts_by_engagement',
    description: 'Query contacts filtered by engagement metrics like email opens, clicks, replies, and overall engagement score. Use this to find active or responsive contacts.',
    parameters: {
      type: 'object',
      properties: {
        minEngagementScore: {
          type: 'number',
          description: 'Minimum engagement score (0-100). Higher scores indicate more engaged contacts.'
        },
        minOpens: {
          type: 'number',
          description: 'Minimum number of email opens'
        },
        minClicks: {
          type: 'number',
          description: 'Minimum number of link clicks'
        },
        minReplies: {
          type: 'number',
          description: 'Minimum number of email replies'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      }
    }
  },
  {
    name: 'query_never_contacted',
    description: 'Get contacts that have never been contacted before (last_contacted_at is NULL). Use this to find fresh prospects.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      }
    }
  },
  {
    name: 'query_contacts_by_agent_fit',
    description: 'Score and rank contacts by how well they match the outreach agent\'s ideal customer profile (ICP). Uses the agent\'s configured segment filters, quality weights, and scoring algorithm. This is the BEST function for finding contacts that fit the agent\'s target persona. USE THIS when user asks about: "best match", "match my product", "ideal customers", "target persona", "right fit", "good fit", "perfect contacts", "suitable contacts".',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the outreach agent to use for ICP scoring'
        },
        threshold: {
          type: 'number',
          description: 'Minimum ICP fit score (0.0-1.0). Higher threshold = better fit required.',
          default: 0.55
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      },
      required: ['agentId']
    }
  },
  {
    name: 'query_contacts_by_status',
    description: 'Filter contacts by their current status. Use this to find active contacts, exclude unsubscribed contacts, or identify bounced emails.',
    parameters: {
      type: 'object',
      properties: {
        statuses: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['active', 'unsubscribed', 'bounced', 'pending', 'invalid']
          },
          description: 'Contact statuses to include (e.g., ["active", "pending"])'
        },
        exclude: {
          type: 'boolean',
          description: 'If true, exclude these statuses instead of including them',
          default: false
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      },
      required: ['statuses']
    }
  },
  {
    name: 'query_contacts_by_recency',
    description: 'Query contacts based on when they were last contacted or when they last engaged. Use this to find contacts ready for follow-up or recently active contacts.',
    parameters: {
      type: 'object',
      properties: {
        lastContactedDays: {
          type: 'number',
          description: 'Find contacts last contacted within this many days ago (e.g., 30 for last month)'
        },
        lastEngagedDays: {
          type: 'number',
          description: 'Find contacts who engaged (opened/clicked/replied) within this many days ago'
        },
        neverContacted: {
          type: 'boolean',
          description: 'If true, find contacts never contacted before',
          default: false
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      }
    }
  },
  {
    name: 'query_contacts_by_enrichment',
    description: 'Filter contacts by enrichment status and data completeness. Use this to find well-enriched contacts with complete data or contacts needing enrichment.',
    parameters: {
      type: 'object',
      properties: {
        enrichmentStatus: {
          type: 'string',
          description: 'Enrichment status to filter by',
          enum: ['complete', 'enriched', 'partial', 'pending', 'failed', 'not_enriched']
        },
        hasLinkedIn: {
          type: 'boolean',
          description: 'Filter for contacts with LinkedIn profile data'
        },
        hasCompanyData: {
          type: 'boolean',
          description: 'Filter for contacts with company information'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return',
          default: 100
        }
      }
    }
  }
]

/**
 * Convert function definitions to Gemini API format
 */
export function toGeminiFunctionDeclarations() {
  return CONTACT_QUERY_FUNCTIONS.map(func => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters
  }))
}