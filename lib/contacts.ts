import { createServerSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'
import { EmailValidationService } from './email-validation'
import { contactSchema, updateContactSchema, csvContactSchema } from './validations'
import type { ContactEngagementStatus } from './contact-engagement'

export interface Contact {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  company?: string
  position?: string
  website?: string
  phone?: string
  linkedin_url?: string
  twitter_url?: string
  country?: string
  city?: string
  timezone?: string
  custom_fields: Record<string, any>
  tags: string[]
  lists?: string[]
  segments: string[]
  source?: string
  unsubscribed_at?: string
  last_contacted_at?: string
  last_opened_at?: string
  last_clicked_at?: string
  last_replied_at?: string
  ai_research_data: Record<string, any>
  ai_personalization_score?: number
  enrichment_data?: EnrichmentData | null
  enrichment_status?: string | null
  enrichment_updated_at?: string | null
  created_at: string
  updated_at: string
  
  // Legacy LinkedIn data (for backwards compatibility)
  linkedin_profile_data?: any
  linkedin_extraction_status?: string | null
  linkedin_extracted_at?: string | null
  
  // NEW: Individual LinkedIn fields for better querying and display
  linkedin_first_name?: string
  linkedin_last_name?: string
  linkedin_headline?: string
  linkedin_summary?: string
  linkedin_about?: string // CRITICAL for personalization
  linkedin_current_company?: string
  linkedin_current_position?: string
  linkedin_industry?: string
  linkedin_location?: string
  linkedin_city?: string
  linkedin_country?: string
  linkedin_country_code?: string
  linkedin_follower_count?: number
  linkedin_connection_count?: number
  linkedin_recommendations_count?: number
  linkedin_profile_completeness?: number
  linkedin_avatar_url?: string
  linkedin_banner_url?: string
  linkedin_experience?: any[]
  linkedin_education?: any[]
  linkedin_skills?: string[]
  linkedin_languages?: any[]
  linkedin_certifications?: any[]
  linkedin_volunteer_experience?: any[]
  linkedin_honors_awards?: any[]
  linkedin_projects?: any[]
  linkedin_courses?: any[]
  linkedin_publications?: any[]
  linkedin_patents?: any[]
  linkedin_organizations?: any[]
  linkedin_posts?: any[]
  linkedin_recommendations?: any[]
  linkedin_people_also_viewed?: any[]
  linkedin_contact_info?: any
  linkedin_services?: any[]
  
  // Contact Notes
  notes?: string | null
  notes_updated_at?: string | null

  // Engagement Quality Rating System
  engagement_status?: 'not_contacted' | 'pending' | 'engaged' | 'bad' | null
  engagement_score?: number | null
  engagement_sent_count?: number | null
  engagement_open_count?: number | null
  engagement_click_count?: number | null
  engagement_reply_count?: number | null
  engagement_bounce_count?: number | null
  engagement_last_positive_at?: string | null
  engagement_updated_at?: string | null
}

export interface EnrichmentData {
  company_name: string
  industry: string
  products_services: string[]
  target_audience: string[]
  unique_points: string[]
  tone_style: string
}

export interface ContactStats {
  total: number
  by_tags: Record<string, number>
  enriched_web: number
  enriched_linkedin: number
  enriched_both: number
  not_enriched: number
}

export class ContactService {
  private async getSupabase() {
    return await createServerSupabaseClient()
  }

  async createContact(userId: string, contactData: Partial<Contact>) {
    // Validate input data using Zod schema
    const validatedData = contactSchema.parse(contactData)
    
    // Check for duplicates
    const duplicate = await this.findDuplicateContact(userId, validatedData.email)
    if (duplicate) {
      const error = new Error(`Contact with email ${validatedData.email} already exists`)
      error.name = 'DuplicateContactError'
      throw error
    }

    // Validate email if requested
    let emailStatus: 'valid' | 'invalid' | 'risky' | 'unknown' = 'unknown'
    try {
      const emailValidation = await EmailValidationService.validateEmail(validatedData.email)
      emailStatus = emailValidation.status
    } catch (error) {
      // If email validation fails, we'll keep it as unknown
      console.warn('Email validation failed:', error)
    }

    const supabase = await this.getSupabase()
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        ...validatedData,
        email: EmailValidationService.normalizeEmail(validatedData.email),
        custom_fields: validatedData.custom_fields || {},
        tags: validatedData.tags || [],
        source: validatedData.source || 'manual', // Default to manual if not specified
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateContact(contactId: string, userId: string, updates: Partial<Contact>) {
    // Validate input data using Zod schema
    const validatedUpdates = updateContactSchema.parse(updates)
    
    // If email is being updated, check for duplicates and validate
    if (validatedUpdates.email) {
      const duplicate = await this.findDuplicateContact(userId, validatedUpdates.email, contactId)
      if (duplicate) {
        throw new Error(`Contact with email ${validatedUpdates.email} already exists`)
      }

      // Validate email if being updated
      try {
        const emailValidation = await EmailValidationService.validateEmail(validatedUpdates.email)
        validatedUpdates.email = EmailValidationService.normalizeEmail(validatedUpdates.email)
        // Email validation completed (no email_status column in database)
      } catch (error) {
        console.warn('Email validation failed during update:', error)
      }
    }

    // Handle enrichment data conversion
    const updatePayload = { ...validatedUpdates } as any
    
    // Check if any enrichment fields are being updated
    const enrichmentFields = [
      'enriched_industry', 'enriched_products_services',
      'enriched_target_audience', 'enriched_unique_points', 'enriched_tone_style'
    ]
    
    const hasEnrichmentUpdate = enrichmentFields.some(field => field in validatedUpdates)
    
    const supabase = await this.getSupabase()

    if (hasEnrichmentUpdate) {
      // First, get the current contact to preserve existing enrichment data
      const { data: currentContact, error: fetchError } = await supabase
        .from('contacts')
        .select('enrichment_data, company')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        console.warn('Could not fetch current contact for enrichment update:', fetchError)
      }

      // Start with existing enrichment data or empty object
      const existingEnrichmentData = currentContact?.enrichment_data || {}
      const enrichmentData: any = { ...existingEnrichmentData }
      
      // Update company name in enrichment data if company field is being updated
      if (validatedUpdates.company !== undefined) {
        enrichmentData.company_name = validatedUpdates.company
      }
      
      // Update other enrichment fields
      if (validatedUpdates.enriched_industry !== undefined) {
        enrichmentData.industry = validatedUpdates.enriched_industry
        delete updatePayload.enriched_industry
      }
      if (validatedUpdates.enriched_products_services !== undefined) {
        enrichmentData.products_services = validatedUpdates.enriched_products_services
          ? validatedUpdates.enriched_products_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        delete updatePayload.enriched_products_services
      }
      if (validatedUpdates.enriched_target_audience !== undefined) {
        enrichmentData.target_audience = validatedUpdates.enriched_target_audience
          ? validatedUpdates.enriched_target_audience.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        delete updatePayload.enriched_target_audience
      }
      if (validatedUpdates.enriched_unique_points !== undefined) {
        enrichmentData.unique_points = validatedUpdates.enriched_unique_points
          ? validatedUpdates.enriched_unique_points.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        delete updatePayload.enriched_unique_points
      }
      if (validatedUpdates.enriched_tone_style !== undefined) {
        enrichmentData.tone_style = validatedUpdates.enriched_tone_style
        delete updatePayload.enriched_tone_style
      }
      
      // Update enrichment data and status
      updatePayload.enrichment_data = enrichmentData
      updatePayload.enrichment_status = 'completed'
      updatePayload.enrichment_updated_at = new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...updatePayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteContact(contactId: string, userId: string) {
    const supabase = await this.getSupabase()
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async getContact(contactId: string, userId: string) {
    const supabase = await this.getSupabase()
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }

  async getUserContacts(
    userId: string,
    options: {
      page?: number
      limit?: number
      search?: string
      tags?: string[]
      enrichment?: string
      engagementStatus?: string
      minScore?: number
      maxScore?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } = {}
  ) {
    const {
      page = 1,
      limit = 50,
      search,
      tags,
      enrichment,
      engagementStatus,
      minScore,
      maxScore,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    const supabase = await this.getSupabase()
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    // Apply filters
    if (search) {
      // Enhanced search across contacts + contact list names/tags
      // Sanitize characters that would break PostgREST or-filter syntax
      const searchTerm = search
        .replace(/'/g, "''")     // escape single quotes
        .replace(/[(),]/g, ' ')    // remove list/tuple separators that break the OR clause
        .trim()

      let listContactIds: string[] = []
      try {
        // Find lists by name or tag that match the term
        const { data: lists } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .eq('user_id', userId)
          .or(`name.ilike.%${searchTerm}%,tags.cs.{"${searchTerm}"}`)

        if (lists && lists.length > 0) {
          const ids = lists.flatMap((l: any) => Array.isArray(l.contact_ids) ? l.contact_ids : [])
          listContactIds = Array.from(new Set(ids))
        }
      } catch (e) {
        console.warn('List search failed; continuing with contact-only search:', e)
      }

      const orParts: string[] = [
        `first_name.ilike.%${searchTerm}%`,
        `last_name.ilike.%${searchTerm}%`,
        `email.ilike.%${searchTerm}%`,
        `company.ilike.%${searchTerm}%`,
        `position.ilike.%${searchTerm}%`,
        `website.ilike.%${searchTerm}%`,
        `phone.ilike.%${searchTerm}%`,
        `country.ilike.%${searchTerm}%`,
        `city.ilike.%${searchTerm}%`,
        `linkedin_url.ilike.%${searchTerm}%`,
        `twitter_url.ilike.%${searchTerm}%`,
        `tags.cs.{"${searchTerm}"}`,
        `enrichment_data->>company_name.ilike.%${searchTerm}%`,
        `enrichment_data->>industry.ilike.%${searchTerm}%`,
        `enrichment_data->>tone_style.ilike.%${searchTerm}%`,
      ]

      if (listContactIds.length > 0) {
        // Limit to avoid overly long URLs; still covers typical list sizes
        const limited = listContactIds.slice(0, 1000)
        const quoted = limited.map((id) => `"${id}"`).join(',')
        orParts.push(`id.in.(${quoted})`)
      }

      query = query.or(orParts.join(','))
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags)
    }

    // Apply enrichment filtering
    if (enrichment) {
      switch (enrichment) {
        case 'web-enriched':
          query = query.eq('enrichment_status', 'completed')
          break
        case 'linkedin-enriched':
          query = query.eq('linkedin_extraction_status', 'completed')
          break
        case 'fully-enriched':
          query = query.eq('enrichment_status', 'completed').eq('linkedin_extraction_status', 'completed')
          break
        case 'not-enriched':
          query = query.or('enrichment_status.is.null,enrichment_status.neq.completed').or('linkedin_extraction_status.is.null,linkedin_extraction_status.neq.completed')
          break
      }
    }

    // Apply engagement filtering
    if (engagementStatus) {
      query = query.eq('engagement_status', engagementStatus)
    }

    // Apply engagement score filtering
    if (minScore !== undefined) {
      query = query.gte('engagement_score', minScore)
    }
    if (maxScore !== undefined) {
      query = query.lte('engagement_score', maxScore)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // Map database fields to frontend expected fields
    let mappedContacts = (data || []).map(contact => ({
      ...contact,
      // Map company field to company_name for frontend compatibility
      company_name: contact.company,
      // Ensure names are not null for display
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      // Extract company name from enrichment data if available and main field is empty
      ...(contact.enrichment_data?.company_name && !contact.company ? {
        company_name: contact.enrichment_data.company_name
      } : {}),
    }))

    mappedContacts = await this.applyEngagementSnapshots(supabase, mappedContacts)

    return {
      contacts: mappedContacts,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    }
  }

  private async applyEngagementSnapshots(
    supabase: Awaited<ReturnType<typeof this.getSupabase>>,
    contacts: any[]
  ): Promise<any[]> {
    if (!contacts.length) return contacts

    const contactIds = contacts.map((contact) => contact.id).filter(Boolean)
    if (!contactIds.length) return contacts

    const { data: trackingRows, error: trackingError } = await supabase
      .from('email_tracking')
      .select('contact_id, sent_at, delivered_at, opened_at, clicked_at, replied_at, bounced_at, complained_at, unsubscribed_at, status')
      .in('contact_id', contactIds)

    if (trackingError) {
      console.error('Failed to load email tracking for engagement snapshots:', trackingError)
      return contacts
    }

    const trackingByContact = new Map<string, any[]>()
    for (const row of trackingRows || []) {
      if (!row.contact_id) continue
      const arr = trackingByContact.get(row.contact_id) || []
      arr.push(row)
      trackingByContact.set(row.contact_id, arr)
    }

    const now = new Date()

    for (const contact of contacts) {
      const rows = trackingByContact.get(contact.id) || []

      const sentCount = rows.filter(row => row.sent_at || row.delivered_at || ['sent', 'delivered', 'opened', 'clicked', 'replied'].includes(row.status || '')).length
      const openCount = rows.filter(row => row.opened_at).length
      const clickCount = rows.filter(row => row.clicked_at).length
      const replyCount = rows.filter(row => row.replied_at).length
      const bounceCount = rows.filter(row => row.status === 'bounced').length

      let lastPositiveAt: Date | null = null
      for (const row of rows) {
        const candidates = [row.replied_at, row.clicked_at, row.opened_at]
        for (const ts of candidates) {
          if (!ts) continue
          const date = new Date(ts)
          if (!lastPositiveAt || date > lastPositiveAt) {
            lastPositiveAt = date
          }
        }
      }

      const hasBounce = rows.some(row => row.status === 'bounced') || contact.status === 'bounced'
      const hasComplaint = rows.some(row => row.status === 'complained') || contact.status === 'complained'
      const hasUnsubscribe = Boolean(contact.unsubscribed_at) || rows.some(row => row.status === 'unsubscribed') || contact.status === 'unsubscribed'
      const hasHardStop = hasBounce || hasComplaint || hasUnsubscribe

      const openScore = Math.min(openCount * 5, 15)
      const clickScore = Math.min(clickCount * 20, 60)
      const replyScore = replyCount * 50

      let score = openScore + clickScore + replyScore

      if (score > 0 && lastPositiveAt) {
        const diffMs = now.getTime() - lastPositiveAt.getTime()
        if (diffMs > 0) {
          const periods = Math.floor(diffMs / (30 * 24 * 60 * 60 * 1000))
          if (periods > 0) {
            score = Math.round(score * Math.pow(0.7, periods))
          }
        }
      }

      if (hasHardStop) {
        score = 0
      }

      score = Math.max(0, Math.min(100, score))

      let engagementStatus: ContactEngagementStatus = 'not_contacted'

      if (hasHardStop) {
        engagementStatus = 'bad'
      } else if (sentCount === 0) {
        engagementStatus = 'not_contacted'
      } else {
        const qualifiesGreen = clickCount > 0 || replyCount > 0 || score >= 50
        engagementStatus = qualifiesGreen ? 'engaged' : 'pending'
      }

      const lastPositiveIso = lastPositiveAt ? lastPositiveAt.toISOString() : null

      const needsUpdate = (
        contact.engagement_status !== engagementStatus ||
        contact.engagement_score !== score ||
        contact.engagement_sent_count !== sentCount ||
        contact.engagement_last_positive_at !== lastPositiveIso ||
        contact.engagement_open_count !== openCount ||
        contact.engagement_click_count !== clickCount ||
        contact.engagement_reply_count !== replyCount ||
        contact.engagement_bounce_count !== bounceCount
      )

      if (needsUpdate) {
        try {
          await supabase
            .from('contacts')
            .update({
              engagement_status: engagementStatus,
              engagement_score: score,
              engagement_sent_count: sentCount,
              engagement_open_count: openCount,
              engagement_click_count: clickCount,
              engagement_reply_count: replyCount,
              engagement_bounce_count: bounceCount,
              engagement_last_positive_at: lastPositiveIso,
              engagement_updated_at: new Date().toISOString()
            })
            .eq('id', contact.id)
        } catch (error) {
          console.error('Failed to persist engagement snapshot for contact', contact.id, error)
        }
      }

      contact.engagement_status = engagementStatus
      contact.engagement_score = score
      contact.engagement_sent_count = sentCount
      contact.engagement_open_count = openCount
      contact.engagement_click_count = clickCount
      contact.engagement_reply_count = replyCount
      contact.engagement_bounce_count = bounceCount
      contact.engagement_last_positive_at = lastPositiveIso
    }

    return contacts
  }

  async getContactsByIds(userId: string, contactIds: string[]) {
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .in('id', contactIds)

    if (error) {
      console.error('Error fetching contacts by IDs:', error)
      throw new Error('Failed to fetch contacts')
    }

    // Map database fields to frontend expected fields
    let mappedData = (data || []).map(contact => ({
      ...contact,
      // Map company field to company_name for frontend compatibility
      company_name: contact.company,
      // Ensure names are not null for display
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      // Extract company name from enrichment data if available and main field is empty
      ...(contact.enrichment_data?.company_name && !contact.company ? {
        company_name: contact.enrichment_data.company_name
      } : {}),
    }))

    mappedData = await this.applyEngagementSnapshots(supabase, mappedData)

    return mappedData
  }

  async getContactStats(userId: string) {
    const supabase = await this.getSupabase()
    const { data, error } = await supabase
      .from('contacts')
      .select('tags, enrichment_status, linkedin_extraction_status')
      .eq('user_id', userId)

    if (error) throw error

    const stats: ContactStats = {
      total: data.length,
      by_tags: {},
      enriched_web: 0,
      enriched_linkedin: 0,
      enriched_both: 0,
      not_enriched: 0,
    }

    data.forEach(contact => {
      // Count by enrichment status
      const isWebEnriched = contact.enrichment_status === 'completed'
      const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
      
      if (isWebEnriched && isLinkedInEnriched) {
        stats.enriched_both++
      } else if (isWebEnriched) {
        stats.enriched_web++
      } else if (isLinkedInEnriched) {
        stats.enriched_linkedin++
      } else {
        stats.not_enriched++
      }

      // Count by tags
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach((tag: string) => {
          stats.by_tags[tag] = (stats.by_tags[tag] || 0) + 1
        })
      }
    })

    return stats
  }

  async bulkCreateContacts(userId: string, contacts: Partial<Contact>[], options: {
    skipDuplicates?: boolean
    validateEmails?: boolean
    source?: string
  } = {}) {
    const { skipDuplicates = true, validateEmails = true, source = 'import' } = options
    
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as { row: number; error: string; data: any }[],
      validationSummary: {
        total: contacts.length,
        valid: 0,
        invalid: 0,
        risky: 0
      }
    }

    // Get existing emails if skipDuplicates is true
    let existingEmails: string[] = []
    if (skipDuplicates) {
      const supabase = await this.getSupabase()
      const { data } = await supabase
        .from('contacts')
        .select('email')
        .eq('user_id', userId)

      existingEmails = data?.map(c => EmailValidationService.normalizeEmail(c.email)) || []
    }

    // Validate emails in bulk if requested
    let emailValidations: any[] = []
    if (validateEmails) {
      const emails = contacts.map(c => c.email).filter(Boolean) as string[]
      const validationResult = await EmailValidationService.validateEmails(emails)
      emailValidations = validationResult.results
      results.validationSummary = {
        total: contacts.length,
        valid: validationResult.summary.valid,
        invalid: validationResult.summary.invalid,
        risky: validationResult.summary.risky
      }
    }

    const contactsToInsert = []

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      
      try {
        // Validate using Zod schema (use CSV schema for bulk imports)
        const validatedContact = this.validateContactData(contact, true)
        const normalizedEmail = EmailValidationService.normalizeEmail(validatedContact.email)
        
        // Skip duplicates if enabled
        if (skipDuplicates && existingEmails.includes(normalizedEmail)) {
          results.skipped++
          continue
        }

        // Get email validation result
        let emailStatus: 'valid' | 'invalid' | 'risky' | 'unknown' = 'unknown'
        if (validateEmails && emailValidations[i]) {
          emailStatus = emailValidations[i].status
          
          // Skip invalid emails if validation is enabled
          if (emailStatus === 'invalid') {
            results.errors.push({
              row: i + 1,
              error: `Invalid email: ${emailValidations[i].reason || 'Email validation failed'}`,
              data: contact,
            })
            continue
          }
        }

        contactsToInsert.push({
          user_id: userId,
          ...validatedContact,
          email: normalizedEmail,
            custom_fields: validatedContact.custom_fields || {},
          tags: validatedContact.tags || [],
          source: source, // Set import source
        })

        // Add to existing emails to prevent duplicates within the same batch
        existingEmails.push(normalizedEmail)

      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: contact,
        })
      }
    }

    // Insert contacts in batches
    if (contactsToInsert.length > 0) {
      const batchSize = 100
      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize)
        
        const supabase = await this.getSupabase()
        const { error } = await supabase
          .from('contacts')
          .insert(batch)

        if (error) {
          // Handle unique constraint violations gracefully
          if (error.code === '23505') { // Unique violation
            results.errors.push({
              row: Math.floor(i / batchSize) + 1,
              error: 'Duplicate email addresses found in batch',
              data: batch,
            })
          } else {
            results.errors.push({
              row: Math.floor(i / batchSize) + 1,
              error: error.message,
              data: batch,
            })
          }
        } else {
          results.created += batch.length
        }
      }
    }

    return results
  }

  async addTagsToContacts(contactIds: string[], userId: string, tags: string[]) {
    // Get current contacts with validation
    const supabase = await this.getSupabase()
    const { data: contacts, error: selectError } = await supabase
      .from('contacts')
      .select('id, tags')
      .in('id', contactIds)
      .eq('user_id', userId)

    if (selectError) {
      console.error('Error fetching contacts for tag update:', selectError)
      throw new Error('Failed to fetch contacts')
    }

    if (!contacts || contacts.length === 0) {
      console.warn('No contacts found for tag update')
      return
    }

    console.log(`Adding tags to ${contacts.length} contacts:`, { tags, contactIds })

    // Update each contact individually to avoid constraint violations
    const errors = []
    for (const contact of contacts) {
      try {
        const updatedTags = Array.from(new Set([...contact.tags, ...tags])) // Merge and deduplicate
        
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            tags: updatedTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id)
          .eq('user_id', userId)

        if (updateError) {
          console.error(`Error updating contact ${contact.id}:`, updateError)
          errors.push({ contactId: contact.id, error: updateError.message })
        }
      } catch (error) {
        console.error(`Failed to update contact ${contact.id}:`, error)
        errors.push({ contactId: contact.id, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    if (errors.length > 0) {
      console.error('Some contacts failed to update:', errors)
      throw new Error(`Failed to update ${errors.length} out of ${contacts.length} contacts`)
    }

    console.log('Successfully added tags to all contacts')
  }

  async removeTagsFromContacts(contactIds: string[], userId: string, tags: string[]) {
    // Get current contacts with validation
    const supabase = await this.getSupabase()
    const { data: contacts, error: selectError } = await supabase
      .from('contacts')
      .select('id, tags')
      .in('id', contactIds)
      .eq('user_id', userId)

    if (selectError) {
      console.error('Error fetching contacts for tag removal:', selectError)
      throw new Error('Failed to fetch contacts')
    }

    if (!contacts || contacts.length === 0) {
      console.warn('No contacts found for tag removal')
      return
    }

    console.log(`Removing tags from ${contacts.length} contacts:`, { tags, contactIds })

    // Update each contact individually to avoid constraint violations
    const errors = []
    for (const contact of contacts) {
      try {
        const updatedTags = contact.tags.filter((tag: string) => !tags.includes(tag))
        
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            tags: updatedTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id)
          .eq('user_id', userId)

        if (updateError) {
          console.error(`Error updating contact ${contact.id}:`, updateError)
          errors.push({ contactId: contact.id, error: updateError.message })
        }
      } catch (error) {
        console.error(`Failed to update contact ${contact.id}:`, error)
        errors.push({ contactId: contact.id, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    if (errors.length > 0) {
      console.error('Some contacts failed to update:', errors)
      throw new Error(`Failed to update ${errors.length} out of ${contacts.length} contacts`)
    }

    console.log('Successfully removed tags from all contacts')
  }

  async bulkUpdateContactStatus(contactIds: string[], userId: string, status: string) {
    const supabase = await this.getSupabase()
    const { error } = await supabase
      .from('contacts')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in('id', contactIds)
      .eq('user_id', userId)

    if (error) throw error
  }

  async exportContacts(userId: string, filters: any = {}) {
    const { contacts } = await this.getUserContacts(userId, {
      ...filters,
      limit: 10000, // Large limit for export
    })

    return contacts
  }

  /**
   * Find duplicate contact by email (excluding a specific contact ID)
   */
  async findDuplicateContact(userId: string, email: string, excludeContactId?: string) {
    const normalizedEmail = EmailValidationService.normalizeEmail(email)
    
    const supabase = await this.getSupabase()
    let query = supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .eq('user_id', userId)
      .eq('email', normalizedEmail)

    if (excludeContactId) {
      query = query.neq('id', excludeContactId)
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error
    }

    return data
  }

  /**
   * Validate contact data using Zod schema
   */
  validateContactData(contactData: any, useCsvSchema: boolean = false) {
    try {
      const schema = useCsvSchema ? csvContactSchema : contactSchema
      return schema.parse(contactData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new Error(`Validation failed: ${errorMessages.join(', ')}`)
      }
      throw error
    }
  }

  /**
   * Enhanced bulk email validation
   */
  async validateContactEmails(contacts: Partial<Contact>[]): Promise<{
    results: Array<{
      contact: Partial<Contact>
      validation: any
      isValid: boolean
    }>
    summary: {
      total: number
      valid: number
      invalid: number
      risky: number
    }
  }> {
    const emails = contacts.map(c => c.email).filter(Boolean) as string[]
    const validationResults = await EmailValidationService.validateEmails(emails)
    
    const results = contacts.map((contact, index) => {
      const validation = validationResults.results[index]
      return {
        contact,
        validation,
        isValid: validation?.isValid || false
      }
    })

    return {
      results,
      summary: {
        total: contacts.length,
        valid: results.filter(r => r.validation?.status === 'valid').length,
        invalid: results.filter(r => r.validation?.status === 'invalid').length,
        risky: results.filter(r => r.validation?.status === 'risky').length
      }
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(userId: string, email: string) {
    const normalizedEmail = EmailValidationService.normalizeEmail(email)
    
    const supabase = await this.getSupabase()
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('email', normalizedEmail)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  }

  /**
   * Merge duplicate contacts
   */
  async mergeDuplicateContacts(userId: string, primaryContactId: string, duplicateContactId: string) {
    // Get both contacts
    const [primary, duplicate] = await Promise.all([
      this.getContact(primaryContactId, userId),
      this.getContact(duplicateContactId, userId)
    ])

    if (!primary || !duplicate) {
      throw new Error('One or both contacts not found')
    }

    // Merge data (primary takes precedence, but fill in missing fields from duplicate)
    const mergedData = {
      ...duplicate,
      ...primary,
      // Merge tags
      tags: Array.from(new Set([...primary.tags, ...duplicate.tags])),
      // Merge custom fields
      custom_fields: { ...duplicate.custom_fields, ...primary.custom_fields },
      // Keep the earliest creation date
      created_at: primary.created_at < duplicate.created_at ? primary.created_at : duplicate.created_at,
      updated_at: new Date().toISOString()
    }

    // Update primary contact with merged data
    await this.updateContact(primaryContactId, userId, mergedData)

    // Delete duplicate contact
    await this.deleteContact(duplicateContactId, userId)

    return mergedData
  }

  /**
   * Bulk delete contacts
   */
  async bulkDeleteContacts(contactIds: string[], userId: string) {
    if (!contactIds || contactIds.length === 0) {
      throw new Error('No contact IDs provided for deletion')
    }

    const supabase = await this.getSupabase()
    
    // Hard delete to respect status constraint and policies
    const { data, error } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId)
      .in('id', contactIds)
      .select('id')

    if (error) {
      console.error('Bulk delete contacts error:', error)
      throw new Error(`Failed to delete contacts: ${error.message}`)
    }

    // After deletion, prune these IDs from any contact_lists.contact_ids arrays
    try {
      // Find lists that reference any of the deleted IDs
      const { data: lists } = await supabase
        .from('contact_lists')
        .select('id, contact_ids')
        .eq('user_id', userId)
        .overlaps('contact_ids', contactIds)

      if (lists && lists.length > 0) {
        for (const list of lists) {
          const updated = (list.contact_ids || []).filter((id: string) => !contactIds.includes(id))
          await supabase
            .from('contact_lists')
            .update({ contact_ids: updated, updated_at: new Date().toISOString() })
            .eq('id', list.id)
            .eq('user_id', userId)
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to prune deleted contacts from contact_lists:', e)
    }

    return {
      success: true,
      deleted_count: data?.length || 0,
      deleted_ids: data?.map(contact => contact.id) || []
    }
  }

  // Contact Notes Management
  async getContactNotes(contactId: string, userId: string) {
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from('contacts')
      .select('id, notes, notes_updated_at')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch contact notes: ${error.message}`)
    }
    
    return {
      notes: data.notes || '',
      notes_updated_at: data.notes_updated_at
    }
  }

  async updateContactNotes(contactId: string, userId: string, notes: string) {
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from('contacts')
      .update({ notes })
      .eq('id', contactId)
      .eq('user_id', userId)
      .select('id, notes, notes_updated_at')
      .single()
    
    if (error) {
      throw new Error(`Failed to update contact notes: ${error.message}`)
    }
    
    return {
      notes: data.notes,
      notes_updated_at: data.notes_updated_at
    }
  }
}
