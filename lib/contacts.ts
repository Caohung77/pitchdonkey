import { createServerSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'
import { EmailValidationService } from './email-validation'
import { contactSchema, updateContactSchema } from './validations'

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
  segments: string[]
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  unsubscribed_at?: string
  last_contacted_at?: string
  last_opened_at?: string
  last_clicked_at?: string
  last_replied_at?: string
  ai_research_data: Record<string, any>
  ai_personalization_score?: number
  created_at: string
  updated_at: string
}

export interface ContactStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  by_status: Record<string, number>
  by_tags: Record<string, number>
}

export class ContactService {
  private supabase = createServerSupabaseClient()

  async createContact(userId: string, contactData: Partial<Contact>) {
    // Validate input data using Zod schema
    const validatedData = contactSchema.parse(contactData)
    
    // Check for duplicates
    const duplicate = await this.findDuplicateContact(userId, validatedData.email)
    if (duplicate) {
      throw new Error(`Contact with email ${validatedData.email} already exists`)
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

    const { data, error } = await this.supabase
      .from('contacts')
      .insert({
        user_id: userId,
        ...validatedData,
        email: EmailValidationService.normalizeEmail(validatedData.email),
        status: 'active',
        custom_fields: validatedData.custom_fields || {},
        tags: validatedData.tags || [],
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

    const { data, error } = await this.supabase
      .from('contacts')
      .update({
        ...validatedUpdates,
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
    const { error } = await this.supabase
      .from('contacts')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async getContact(contactId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
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
      status?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } = {}
  ) {
    const {
      page = 1,
      limit = 50,
      search,
      tags,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    let query = this.supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'deleted')

    // Apply filters
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags)
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

  async getContactStats(userId: string) {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('status, tags')
      .eq('user_id', userId)
      .neq('status', 'deleted')

    if (error) throw error

    const stats: ContactStats = {
      total: data.length,
      active: 0,
      unsubscribed: 0,
      bounced: 0,
      by_status: {},
      by_tags: {},
    }

    data.forEach(contact => {
      // Count by status
      stats.by_status[contact.status] = (stats.by_status[contact.status] || 0) + 1
      
      if (contact.status === 'active') stats.active++
      if (contact.status === 'unsubscribed') stats.unsubscribed++
      if (contact.status === 'bounced') stats.bounced++

      // Count by tags
      contact.tags.forEach((tag: string) => {
        stats.by_tags[tag] = (stats.by_tags[tag] || 0) + 1
      })
    })

    return stats
  }

  async bulkCreateContacts(userId: string, contacts: Partial<Contact>[], options: {
    skipDuplicates?: boolean
    validateEmails?: boolean
  } = {}) {
    const { skipDuplicates = true, validateEmails = true } = options
    
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
      const { data } = await this.supabase
        .from('contacts')
        .select('email')
        .eq('user_id', userId)
        .neq('status', 'deleted')

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
        // Validate using Zod schema
        const validatedContact = this.validateContactData(contact)
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
          status: 'active',
          custom_fields: validatedContact.custom_fields || {},
          tags: validatedContact.tags || [],
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
        
        const { error } = await this.supabase
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
    // Get current contacts
    const { data: contacts } = await this.supabase
      .from('contacts')
      .select('id, tags')
      .in('id', contactIds)
      .eq('user_id', userId)

    if (!contacts) return

    // Update each contact with new tags
    const updates = contacts.map(contact => ({
      id: contact.id,
      tags: Array.from(new Set([...contact.tags, ...tags])), // Merge and deduplicate
      updated_at: new Date().toISOString(),
    }))

    const { error } = await this.supabase
      .from('contacts')
      .upsert(updates)

    if (error) throw error
  }

  async removeTagsFromContacts(contactIds: string[], userId: string, tags: string[]) {
    // Get current contacts
    const { data: contacts } = await this.supabase
      .from('contacts')
      .select('id, tags')
      .in('id', contactIds)
      .eq('user_id', userId)

    if (!contacts) return

    // Update each contact by removing tags
    const updates = contacts.map(contact => ({
      id: contact.id,
      tags: contact.tags.filter((tag: string) => !tags.includes(tag)),
      updated_at: new Date().toISOString(),
    }))

    const { error } = await this.supabase
      .from('contacts')
      .upsert(updates)

    if (error) throw error
  }

  async bulkUpdateContactStatus(contactIds: string[], userId: string, status: string) {
    const { error } = await this.supabase
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
    
    let query = this.supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .eq('user_id', userId)
      .eq('email', normalizedEmail)
      .neq('status', 'deleted')

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
  validateContactData(contactData: any) {
    try {
      return contactSchema.parse(contactData)
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
    
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('email', normalizedEmail)
      .neq('status', 'deleted')
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
}