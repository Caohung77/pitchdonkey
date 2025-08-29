import { createServerSupabaseClient } from './supabase-server'
import { ContactEnrichmentService } from './contact-enrichment'

interface BulkEnrichmentJob {
  id: string
  user_id: string
  contact_ids: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  options: {
    force_refresh: boolean
    batch_size: number
    timeout: number
  }
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
  results: Array<{
    contact_id: string
    email: string
    company?: string
    website_url?: string
    scrape_status: 'completed' | 'failed' | 'pending' | 'running'
    enrichment_data?: any
    error?: {
      type: string
      message: string
      retryable: boolean
    }
    scraped_at?: string
  }>
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
}

interface BulkEnrichmentOptions {
  force_refresh?: boolean
  batch_size?: number
  timeout?: number
}

interface EnrichmentEligibility {
  eligible: Array<{
    id: string
    email: string
    company?: string
    website: string
  }>
  already_enriched: Array<{
    id: string
    email: string
    company?: string
    last_enriched: string
  }>
  no_website: Array<{
    id: string
    email: string
    company?: string
  }>
  processing: Array<{
    id: string
    email: string
    status: string
  }>
}

export class BulkContactEnrichmentService {
  private enrichmentService: ContactEnrichmentService

  constructor() {
    this.enrichmentService = new ContactEnrichmentService()
  }

  /**
   * Create a new bulk enrichment job
   */
  async createBulkEnrichmentJob(
    userId: string,
    contactIds: string[],
    options: BulkEnrichmentOptions = {}
  ): Promise<{ success: boolean; job_id?: string; error?: string; summary?: any }> {
    try {
      // No initialization checks needed - we use existing API endpoints

      const supabase = await createServerSupabaseClient()

      // Set default options
      const jobOptions = {
        force_refresh: options.force_refresh || false,
        batch_size: options.batch_size || 3,
        timeout: options.timeout || 30
      }

      // Validate contacts and get eligibility
      const eligibility = await this.getEnrichmentEligibility(contactIds, userId)
      
      const eligibleContactIds = jobOptions.force_refresh
        ? [...eligibility.eligible.map(c => c.id), ...eligibility.already_enriched.map(c => c.id)]
        : eligibility.eligible.map(c => c.id)

      if (eligibleContactIds.length === 0) {
        return {
          success: false,
          error: 'No contacts eligible for enrichment',
          summary: {
            total_requested: contactIds.length,
            eligible_contacts: eligibility.eligible.length,
            ineligible_contacts: eligibility.no_website.length + eligibility.processing.length,
            already_processing: eligibility.processing.length
          }
        }
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('bulk_enrichment_jobs')
        .insert({
          user_id: userId,
          contact_ids: eligibleContactIds,
          options: jobOptions,
          progress: {
            total: eligibleContactIds.length,
            completed: 0,
            failed: 0,
            current_batch: 1
          },
          results: []
        })
        .select('id')
        .single()

      if (jobError) {
        console.error('Failed to create bulk enrichment job:', jobError)
        return { success: false, error: 'Failed to create enrichment job' }
      }

      // Start processing the job asynchronously
      this.processBulkEnrichmentJob(job.id).catch(error => {
        console.error('Bulk enrichment job processing failed:', error)
      })

      return {
        success: true,
        job_id: job.id,
        summary: {
          total_requested: contactIds.length,
          eligible_contacts: eligibleContactIds.length,
          ineligible_contacts: contactIds.length - eligibleContactIds.length,
          already_processing: eligibility.processing.length
        }
      }

    } catch (error) {
      console.error('Error creating bulk enrichment job:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Process a bulk enrichment job
   */
  async processBulkEnrichmentJob(jobId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    
    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('bulk_enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job || job.status !== 'pending') {
        console.error('Job not found or not in pending status:', jobError)
        return
      }

      // Update job status to running
      await this.updateJobStatus(jobId, 'running')

      console.log(`🚀 Starting bulk enrichment job ${jobId} for ${job.contact_ids.length} contacts`)

      // Process contacts in batches
      const batches = this.createBatches(job.contact_ids, job.options.batch_size || 3)
      let totalCompleted = 0
      let totalFailed = 0

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        
        console.log(`📦 Processing batch ${i + 1} of ${batches.length} (${batch.length} contacts)`)
        
        // Update current batch progress
        await this.updateJobProgress(jobId, { current_batch: i + 1 })

        // Process batch with error handling
        const batchResults = await this.processBatch(jobId, batch, job.user_id, job.options)
        
        // Count successes and failures
        const batchCompleted = batchResults.filter(r => r.success).length
        const batchFailed = batchResults.filter(r => !r.success).length
        
        totalCompleted += batchCompleted
        totalFailed += batchFailed

        // Update overall progress
        await this.updateJobProgress(jobId, {
          completed: totalCompleted,
          failed: totalFailed
        })

        console.log(`✅ Batch ${i + 1} completed: ${batchCompleted} successful, ${batchFailed} failed`)

        // Rate limiting between batches (2 seconds)
        if (i < batches.length - 1) {
          await this.delay(2000)
        }
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed')
      console.log(`🎉 Bulk enrichment job ${jobId} completed: ${totalCompleted} successful, ${totalFailed} failed`)

    } catch (error) {
      console.error('Bulk enrichment job processing failed:', error)
      await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Process a single batch of contacts
   */
  private async processBatch(
    jobId: string,
    contactIds: string[],
    userId: string,
    options: any
  ): Promise<Array<{ contact_id: string; success: boolean; error?: string }>> {
    const results: Array<{ contact_id: string; success: boolean; error?: string }> = []

    // Process contacts in parallel within the batch
    const promises = contactIds.map(async (contactId) => {
      try {
        console.log(`🔍 Enriching contact ${contactId}`)
        
        // Update contact result to 'running'
        await this.updateContactResult(jobId, contactId, 'running')

        // Perform enrichment using existing service
        const result = await this.enrichmentService.enrichContact(contactId, userId)

        if (result.success) {
          console.log(`✅ Contact ${contactId} enriched successfully`)
          await this.updateContactResult(jobId, contactId, 'completed', {
            enrichment_data: result.data,
            website_url: result.website_url,
            scraped_at: new Date().toISOString()
          })
          results.push({ contact_id: contactId, success: true })
        } else {
          console.log(`❌ Contact ${contactId} enrichment failed: ${result.error}`)
          await this.updateContactResult(jobId, contactId, 'failed', {
            error: {
              type: 'enrichment_error',
              message: result.error || 'Unknown error',
              retryable: true
            },
            website_url: result.website_url
          })
          results.push({ contact_id: contactId, success: false, error: result.error })
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Contact ${contactId} processing failed:`, errorMessage)
        
        await this.updateContactResult(jobId, contactId, 'failed', {
          error: {
            type: 'processing_error',
            message: errorMessage,
            retryable: true
          }
        })
        results.push({ contact_id: contactId, success: false, error: errorMessage })
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  /**
   * Get enrichment eligibility for contacts
   */
  async getEnrichmentEligibility(contactIds: string[], userId: string): Promise<EnrichmentEligibility> {
    const supabase = await createServerSupabaseClient()

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, email, company, website, enrichment_status, enrichment_updated_at')
      .in('id', contactIds)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to get contact eligibility:', error)
      return { eligible: [], already_enriched: [], no_website: [], processing: [] }
    }

    const eligible: any[] = []
    const already_enriched: any[] = []
    const no_website: any[] = []
    const processing: any[] = []

    contacts?.forEach(contact => {
      if (!contact.website) {
        no_website.push({
          id: contact.id,
          email: contact.email,
          company: contact.company
        })
      } else if (contact.enrichment_status === 'pending') {
        processing.push({
          id: contact.id,
          email: contact.email,
          status: contact.enrichment_status
        })
      } else if (contact.enrichment_status === 'completed' && this.isRecentlyEnriched(contact.enrichment_updated_at)) {
        already_enriched.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          last_enriched: contact.enrichment_updated_at
        })
      } else {
        eligible.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          website: contact.website
        })
      }
    })

    return { eligible, already_enriched, no_website, processing }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<BulkEnrichmentJob | null> {
    const supabase = await createServerSupabaseClient()

    const { data: job, error } = await supabase
      .from('bulk_enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      console.error('Failed to get job status:', error)
      return null
    }

    return job as BulkEnrichmentJob
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.updateJobStatus(jobId, 'cancelled')
      return true
    } catch (error) {
      console.error('Failed to cancel job:', error)
      return false
    }
  }

  // Helper methods
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isRecentlyEnriched(lastEnriched: string | null): boolean {
    if (!lastEnriched) return false
    const lastEnrichedDate = new Date(lastEnriched)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return lastEnrichedDate > oneDayAgo
  }

  private async updateJobStatus(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
    error?: string
  ): Promise<void> {
    const supabase = await createServerSupabaseClient()

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'running' && !error) {
      updateData.started_at = new Date().toISOString()
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.completed_at = new Date().toISOString()
    }

    if (error) {
      updateData.error = error
    }

    await supabase
      .from('bulk_enrichment_jobs')
      .update(updateData)
      .eq('id', jobId)
  }

  private async updateJobProgress(jobId: string, progressUpdate: Partial<{ completed: number; failed: number; current_batch: number }>): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Get current job to merge progress
    const { data: job } = await supabase
      .from('bulk_enrichment_jobs')
      .select('progress')
      .eq('id', jobId)
      .single()

    if (job) {
      const updatedProgress = {
        ...job.progress,
        ...progressUpdate
      }

      await supabase
        .from('bulk_enrichment_jobs')
        .update({ 
          progress: updatedProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
    }
  }

  private async updateContactResult(
    jobId: string,
    contactId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    additionalData: any = {}
  ): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Get current job results
    const { data: job } = await supabase
      .from('bulk_enrichment_jobs')
      .select('results')
      .eq('id', jobId)
      .single()

    if (job) {
      const results = Array.isArray(job.results) ? job.results : []
      
      // Find existing result or create new one
      const existingIndex = results.findIndex((r: any) => r.contact_id === contactId)
      
      const resultData = {
        contact_id: contactId,
        scrape_status: status,
        ...additionalData
      }

      if (existingIndex >= 0) {
        results[existingIndex] = { ...results[existingIndex], ...resultData }
      } else {
        results.push(resultData)
      }

      await supabase
        .from('bulk_enrichment_jobs')
        .update({ 
          results,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
    }
  }
}