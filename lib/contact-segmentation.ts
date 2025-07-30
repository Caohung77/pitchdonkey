import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Contact } from './contacts'

export interface SegmentRule {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: string | string[] | number
}

export interface SegmentCondition {
  rules: SegmentRule[]
  logic: 'AND' | 'OR'
}

export interface ContactSegment {
  id: string
  user_id: string
  name: string
  description?: string
  conditions: SegmentCondition[]
  logic: 'AND' | 'OR' // Logic between conditions
  contact_count: number
  is_dynamic: boolean // True for dynamic segments, false for static
  created_at: string
  updated_at: string
}

export interface SegmentStats {
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

export class ContactSegmentationService {
  private supabase = createRouteHandlerClient({ cookies })

  /**
   * Create a new contact segment
   */
  async createSegment(userId: string, segmentData: Omit<ContactSegment, 'id' | 'user_id' | 'contact_count' | 'created_at' | 'updated_at'>) {
    // Calculate initial contact count
    const contactCount = await this.calculateSegmentCount(userId, segmentData.conditions, segmentData.logic)

    const { data, error } = await this.supabase
      .from('contact_segments')
      .insert({
        user_id: userId,
        ...segmentData,
        contact_count: contactCount,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update an existing segment
   */
  async updateSegment(segmentId: string, userId: string, updates: Partial<ContactSegment>) {
    // Recalculate contact count if conditions changed
    if (updates.conditions || updates.logic) {
      const segment = await this.getSegment(segmentId, userId)
      if (segment) {
        const contactCount = await this.calculateSegmentCount(
          userId, 
          updates.conditions || segment.conditions,
          updates.logic || segment.logic
        )
        updates.contact_count = contactCount
      }
    }

    const { data, error } = await this.supabase
      .from('contact_segments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', segmentId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete a segment
   */
  async deleteSegment(segmentId: string, userId: string) {
    const { error } = await this.supabase
      .from('contact_segments')
      .delete()
      .eq('id', segmentId)
      .eq('user_id', userId)

    if (error) throw error
  }

  /**
   * Get a specific segment
   */
  async getSegment(segmentId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('contact_segments')
      .select('*')
      .eq('id', segmentId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get all segments for a user
   */
  async getUserSegments(userId: string, options: {
    includeContactCount?: boolean
  } = {}) {
    const { data, error } = await this.supabase
      .from('contact_segments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Update contact counts for dynamic segments if requested
    if (options.includeContactCount && data) {
      for (const segment of data) {
        if (segment.is_dynamic) {
          const count = await this.calculateSegmentCount(userId, segment.conditions, segment.logic)
          if (count !== segment.contact_count) {
            await this.updateSegment(segment.id, userId, { contact_count: count })
            segment.contact_count = count
          }
        }
      }
    }

    return data || []
  }

  /**
   * Get contacts that match a segment
   */
  async getSegmentContacts(segmentId: string, userId: string, options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    const segment = await this.getSegment(segmentId, userId)
    if (!segment) {
      throw new Error('Segment not found')
    }

    return this.getContactsByConditions(userId, segment.conditions, segment.logic, options)
  }

  /**
   * Get contacts that match specific conditions
   */
  async getContactsByConditions(
    userId: string, 
    conditions: SegmentCondition[], 
    logic: 'AND' | 'OR',
    options: {
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } = {}
  ) {
    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    let query = this.supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'deleted')

    // Build the query based on conditions
    const whereClause = this.buildWhereClause(conditions, logic)
    if (whereClause) {
      query = query.or(whereClause)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return {
      contacts: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    }
  }

  /**
   * Calculate the number of contacts that match segment conditions
   */
  async calculateSegmentCount(userId: string, conditions: SegmentCondition[], logic: 'AND' | 'OR'): Promise<number> {
    let query = this.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'deleted')

    const whereClause = this.buildWhereClause(conditions, logic)
    if (whereClause) {
      query = query.or(whereClause)
    }

    const { count, error } = await query

    if (error) throw error
    return count || 0
  }

  /**
   * Build SQL where clause from segment conditions
   */
  private buildWhereClause(conditions: SegmentCondition[], logic: 'AND' | 'OR'): string {
    if (!conditions || conditions.length === 0) return ''

    const conditionClauses = conditions.map(condition => {
      const ruleClauses = condition.rules.map(rule => this.buildRuleClause(rule))
      return ruleClauses.length > 1 
        ? `(${ruleClauses.join(` ${condition.logic} `)})`
        : ruleClauses[0]
    }).filter(Boolean)

    if (conditionClauses.length === 0) return ''
    if (conditionClauses.length === 1) return conditionClauses[0]

    return logic === 'AND' 
      ? conditionClauses.join(' AND ')
      : conditionClauses.join(' OR ')
  }

  /**
   * Build SQL clause for a single rule
   */
  private buildRuleClause(rule: SegmentRule): string {
    const { field, operator, value } = rule

    switch (operator) {
      case 'equals':
        return `${field}.eq.${value}`
      case 'not_equals':
        return `${field}.neq.${value}`
      case 'contains':
        return `${field}.ilike.%${value}%`
      case 'not_contains':
        return `not.${field}.ilike.%${value}%`
      case 'starts_with':
        return `${field}.ilike.${value}%`
      case 'ends_with':
        return `${field}.ilike.%${value}`
      case 'is_empty':
        return `${field}.is.null`
      case 'is_not_empty':
        return `not.${field}.is.null`
      case 'greater_than':
        return `${field}.gt.${value}`
      case 'less_than':
        return `${field}.lt.${value}`
      case 'in':
        if (Array.isArray(value)) {
          return `${field}.in.(${value.join(',')})`
        }
        return `${field}.eq.${value}`
      case 'not_in':
        if (Array.isArray(value)) {
          return `not.${field}.in.(${value.join(',')})`
        }
        return `${field}.neq.${value}`
      default:
        return `${field}.eq.${value}`
    }
  }

  /**
   * Get predefined segment templates
   */
  static getSegmentTemplates(): Array<{
    name: string
    description: string
    conditions: SegmentCondition[]
    logic: 'AND' | 'OR'
  }> {
    return [
      {
        name: 'Active Prospects',
        description: 'Contacts who are active and have valid emails',
        conditions: [{
          rules: [
            { field: 'status', operator: 'equals', value: 'active' },
            { field: 'email_status', operator: 'in', value: ['valid', 'risky'] }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'Technology Companies',
        description: 'Contacts from technology industry',
        conditions: [{
          rules: [
            { field: 'industry', operator: 'contains', value: 'technology' },
            { field: 'status', operator: 'equals', value: 'active' }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'Decision Makers',
        description: 'Contacts with executive or management titles',
        conditions: [{
          rules: [
            { field: 'job_title', operator: 'contains', value: 'CEO' },
            { field: 'job_title', operator: 'contains', value: 'CTO' },
            { field: 'job_title', operator: 'contains', value: 'Manager' },
            { field: 'job_title', operator: 'contains', value: 'Director' },
            { field: 'job_title', operator: 'contains', value: 'VP' }
          ],
          logic: 'OR'
        }],
        logic: 'AND'
      },
      {
        name: 'Recently Added',
        description: 'Contacts added in the last 30 days',
        conditions: [{
          rules: [
            { field: 'created_at', operator: 'greater_than', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'Never Contacted',
        description: 'Contacts who have never been sent an email',
        conditions: [{
          rules: [
            { field: 'last_contacted', operator: 'is_empty', value: '' },
            { field: 'status', operator: 'equals', value: 'active' }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'High Engagement',
        description: 'Contacts with high email engagement rates',
        conditions: [{
          rules: [
            { field: 'emails_opened', operator: 'greater_than', value: 2 },
            { field: 'emails_clicked', operator: 'greater_than', value: 0 }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'Bounced Emails',
        description: 'Contacts with bounced email status',
        conditions: [{
          rules: [
            { field: 'status', operator: 'equals', value: 'bounced' }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      },
      {
        name: 'Unsubscribed',
        description: 'Contacts who have unsubscribed',
        conditions: [{
          rules: [
            { field: 'status', operator: 'equals', value: 'unsubscribed' }
          ],
          logic: 'AND'
        }],
        logic: 'AND'
      }
    ]
  }

  /**
   * Get segment statistics
   */
  async getSegmentStats(userId: string): Promise<SegmentStats> {
    const segments = await this.getUserSegments(userId)
    
    const stats: SegmentStats = {
      total_segments: segments.length,
      dynamic_segments: segments.filter(s => s.is_dynamic).length,
      static_segments: segments.filter(s => !s.is_dynamic).length,
      largest_segment: {
        name: '',
        count: 0
      },
      most_used_fields: []
    }

    // Find largest segment
    if (segments.length > 0) {
      const largest = segments.reduce((prev, current) => 
        prev.contact_count > current.contact_count ? prev : current
      )
      stats.largest_segment = {
        name: largest.name,
        count: largest.contact_count
      }
    }

    // Calculate most used fields
    const fieldUsage: Record<string, number> = {}
    segments.forEach(segment => {
      segment.conditions.forEach(condition => {
        condition.rules.forEach(rule => {
          fieldUsage[rule.field] = (fieldUsage[rule.field] || 0) + 1
        })
      })
    })

    stats.most_used_fields = Object.entries(fieldUsage)
      .map(([field, count]) => ({ field, usage_count: count }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 5)

    return stats
  }

  /**
   * Refresh contact counts for all dynamic segments
   */
  async refreshSegmentCounts(userId: string) {
    const segments = await this.getUserSegments(userId)
    const dynamicSegments = segments.filter(s => s.is_dynamic)

    for (const segment of dynamicSegments) {
      const newCount = await this.calculateSegmentCount(userId, segment.conditions, segment.logic)
      if (newCount !== segment.contact_count) {
        await this.updateSegment(segment.id, userId, { contact_count: newCount })
      }
    }
  }

  /**
   * Get available fields for segmentation
   */
  static getAvailableFields(): Array<{
    field: string
    label: string
    type: 'string' | 'number' | 'date' | 'boolean' | 'array'
    operators: string[]
  }> {
    return [
      {
        field: 'email',
        label: 'Email',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with']
      },
      {
        field: 'first_name',
        label: 'First Name',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'last_name',
        label: 'Last Name',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'company_name',
        label: 'Company',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'job_title',
        label: 'Job Title',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'industry',
        label: 'Industry',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'website',
        label: 'Website',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        field: 'phone',
        label: 'Phone',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']
      },
      {
        field: 'status',
        label: 'Status',
        type: 'string',
        operators: ['equals', 'not_equals', 'in', 'not_in']
      },
      {
        field: 'email_status',
        label: 'Email Status',
        type: 'string',
        operators: ['equals', 'not_equals', 'in', 'not_in']
      },
      {
        field: 'tags',
        label: 'Tags',
        type: 'array',
        operators: ['contains', 'not_contains', 'is_empty', 'is_not_empty']
      },
      {
        field: 'created_at',
        label: 'Created Date',
        type: 'date',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than']
      },
      {
        field: 'last_contacted',
        label: 'Last Contacted',
        type: 'date',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
      },
      {
        field: 'emails_sent',
        label: 'Emails Sent',
        type: 'number',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than']
      },
      {
        field: 'emails_opened',
        label: 'Emails Opened',
        type: 'number',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than']
      },
      {
        field: 'emails_clicked',
        label: 'Emails Clicked',
        type: 'number',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than']
      },
      {
        field: 'emails_replied',
        label: 'Emails Replied',
        type: 'number',
        operators: ['equals', 'not_equals', 'greater_than', 'less_than']
      }
    ]
  }
}