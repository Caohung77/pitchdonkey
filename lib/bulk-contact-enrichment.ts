import { createServerSupabaseClient } from './supabase-server'
import { ContactEnrichmentService } from './contact-enrichment'
import { SmartEnrichmentOrchestrator } from './smart-enrichment-orchestrator'

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
  linkedin_only: Array<{
    id: string
    email: string
    company?: string
    linkedin_url: string
  }>
  already_enriched: Array<{
    id: string
    email: string
    company?: string
    last_enriched: string
  }>
  no_sources: Array<{
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
  private smartOrchestrator: SmartEnrichmentOrchestrator

  constructor() {
    this.enrichmentService = new ContactEnrichmentService()
    this.smartOrchestrator = new SmartEnrichmentOrchestrator()
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
        ? [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id), ...eligibility.already_enriched.map(c => c.id)]
        : [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id)]

      if (eligibleContactIds.length === 0) {
        return {
          success: false,
          error: 'No contacts eligible for enrichment',
          summary: {
            total_requested: contactIds.length,
            eligible_contacts: eligibility.eligible.length + eligibility.linkedin_only.length,
            ineligible_contacts: eligibility.no_sources.length + eligibility.processing.length,
            already_processing: eligibility.processing.length,
            linkedin_only: eligibility.linkedin_only.length,
            website_eligible: eligibility.eligible.length
          }
        }
      }

      // Create job record
      console.log('🔍 Creating bulk enrichment job with data:', {
        user_id: userId,
        contact_ids: eligibleContactIds,
        options: jobOptions,
        progress: {
          total: eligibleContactIds.length,
          completed: 0,
          failed: 0,
          current_batch: 1
        }
      })

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

      console.log('🔍 Database insert result:', { job, jobError })

      if (jobError) {
        console.error('Failed to create bulk enrichment job:', jobError)
        return { success: false, error: 'Failed to create enrichment job' }
      }

      // Start processing the job asynchronously
      this.processBulkEnrichmentJob(job.id).catch(error => {
        console.error('Bulk enrichment job processing failed:', error)
      })

      const returnResult = {
        success: true,
        job_id: job.id,
        summary: {
          total_requested: contactIds.length,
          eligible_contacts: eligibleContactIds.length,
          ineligible_contacts: contactIds.length - eligibleContactIds.length,
          already_processing: eligibility.processing.length
        }
      }

      console.log('🔍 Returning from createBulkEnrichmentJob:', returnResult)
      return returnResult

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
      const batches = this.createBatches(job.contact_ids, (job.options as any)?.batch_size || 3)
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

        // Rate limiting between batches (2 seconds) - increased to 3 seconds for better progress visibility
        if (i < batches.length - 1) {
          await this.delay(3000)
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

    // Process contacts sequentially within the batch for better progress visibility
    for (const contactId of contactIds) {
      try {
        console.log(`🔍 Enriching contact ${contactId}`)
        
        // Update contact result to 'running'
        await this.updateContactResult(jobId, contactId, 'running')

        // Get contact details to determine enrichment strategy
        const supabase = await createServerSupabaseClient()
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, website, linkedin_url')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()

        if (!contact) {
          throw new Error('Contact not found')
        }

        // Determine enrichment strategy based on available sources
        let result
        if (contact.website) {
          // Has website - use traditional enrichment or smart enrichment
          console.log(`🌐 Using website enrichment for contact ${contactId}`)
          result = await this.enrichmentService.enrichContact(contactId, userId)
        } else if (contact.linkedin_url) {
          // LinkedIn-only - use smart enrichment orchestrator
          console.log(`🔗 Using LinkedIn-only enrichment for contact ${contactId}`)
          result = await this.smartOrchestrator.enrichContact(contactId, userId)
        } else {
          throw new Error('Contact has no website or LinkedIn URL for enrichment')
        }

        if (result.success) {
          console.log(`✅ Contact ${contactId} enriched successfully`)
          
          // Handle different result structures
          const enrichmentData = contact.website 
            ? {
                enrichment_data: result.data,
                website_url: result.website_url,
                scraped_at: new Date().toISOString()
              }
            : {
                enrichment_sources: result.sources_used,
                linkedin_data: result.linkedin_data,
                enrichment_data: result.enrichment_data,
                primary_source: result.primary_source,
                secondary_source: result.secondary_source,
                scraped_at: new Date().toISOString()
              }
          
          await this.updateContactResult(jobId, contactId, 'completed', enrichmentData)
          results.push({ contact_id: contactId, success: true })
          
          // Update job progress after each successful contact
          const currentCompleted = results.filter(r => r.success).length
          const currentFailed = results.filter(r => !r.success).length
          await this.updateJobProgress(jobId, {
            completed: currentCompleted,
            failed: currentFailed
          })
          console.log(`📊 Progress updated: ${currentCompleted} completed, ${currentFailed} failed`)
          
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
          
          // Update job progress after each failed contact
          const currentCompleted = results.filter(r => r.success).length
          const currentFailed = results.filter(r => !r.success).length
          await this.updateJobProgress(jobId, {
            completed: currentCompleted,
            failed: currentFailed
          })
          console.log(`📊 Progress updated: ${currentCompleted} completed, ${currentFailed} failed`)
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
        
        // Update job progress after each failed contact
        const currentCompleted = results.filter(r => r.success).length
        const currentFailed = results.filter(r => !r.success).length
        await this.updateJobProgress(jobId, {
          completed: currentCompleted,
          failed: currentFailed
        })
        console.log(`📊 Progress updated: ${currentCompleted} completed, ${currentFailed} failed`)
      }

      // Small delay between contacts for better progress visibility (1 second)
      if (contactIds.indexOf(contactId) < contactIds.length - 1) {
        await this.delay(1000)
      }
    }
    return results
  }

  /**
   * Get enrichment eligibility for contacts
   */
  async getEnrichmentEligibility(contactIds: string[], userId: string): Promise<EnrichmentEligibility> {
    const supabase = await createServerSupabaseClient()

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        id, email, company, website, linkedin_url,
        enrichment_status, enrichment_updated_at,
        linkedin_extraction_status, linkedin_extracted_at
      `)
      .in('id', contactIds)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to get contact eligibility:', error)
      return { eligible: [], linkedin_only: [], already_enriched: [], no_sources: [], processing: [] }
    }

    const eligible: any[] = []
    const linkedin_only: any[] = []
    const already_enriched: any[] = []
    const no_sources: any[] = []
    const processing: any[] = []

    contacts?.forEach(contact => {
      const hasWebsite = !!contact.website
      const hasLinkedIn = !!contact.linkedin_url
      const isWebsiteEnriched = contact.enrichment_status === 'completed' && this.isRecentlyEnriched(contact.enrichment_updated_at)
      const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed' && this.isRecentlyEnriched(contact.linkedin_extracted_at)
      const isProcessing = contact.enrichment_status === 'pending' || contact.linkedin_extraction_status === 'pending'

      if (isProcessing) {
        processing.push({
          id: contact.id,
          email: contact.email,
          status: contact.enrichment_status || contact.linkedin_extraction_status
        })
      } else if (isWebsiteEnriched || isLinkedInEnriched) {
        already_enriched.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          last_enriched: contact.enrichment_updated_at || contact.linkedin_extracted_at
        })
      } else if (!hasWebsite && !hasLinkedIn) {
        no_sources.push({
          id: contact.id,
          email: contact.email,
          company: contact.company
        })
      } else if (!hasWebsite && hasLinkedIn) {
        // Has LinkedIn but no website - can use LinkedIn-only enrichment
        linkedin_only.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          linkedin_url: contact.linkedin_url
        })
      } else {
        // Has website (and maybe LinkedIn) - can use standard or smart enrichment
        eligible.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          website: contact.website
        })
      }
    })

    return { eligible, linkedin_only, already_enriched, no_sources, processing }
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

    return job as unknown as BulkEnrichmentJob
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
        ...(job.progress as Record<string, any> || {}),
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
        results[existingIndex] = { ...(results[existingIndex] as Record<string, any>), ...resultData }
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