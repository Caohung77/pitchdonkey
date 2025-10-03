import { createServerSupabaseClient } from './supabase-server'
import { ContactEnrichmentService } from './contact-enrichment'
import { SmartEnrichmentOrchestrator } from './smart-enrichment-orchestrator'

// Personal email domains that should be skipped for business enrichment
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'web.de', 'gmx.de', 'gmx.net', 't-online.de', 'freenet.de',
  'aol.com', 'live.com', 'me.com', 'msn.com', 'ymail.com',
  'protonmail.com', 'tutanota.com', '1und1.de', 'arcor.de'
])

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/
  const match = email.match(emailRegex)
  return match ? match[1].toLowerCase() : null
}

/**
 * Check if domain is a personal email provider
 */
function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase())
}

/**
 * Check if contact has a business email that can be used for enrichment
 */
function hasBusinessEmail(email: string | null): boolean {
  if (!email) return false
  const domain = extractDomainFromEmail(email)
  return !!(domain && !isPersonalEmailDomain(domain))
}

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

      // Don't start processing here - let the cron job or manual trigger handle it
      // This prevents Vercel serverless timeout issues
      console.log(`📋 Job ${job.id} created and queued for processing`)

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
   * Process the next batch for a job (serverless-friendly version)
   * This processes ONE batch and then triggers itself for the next batch
   */
  async processNextBatch(jobId: string): Promise<{ hasMore: boolean; completed: boolean }> {
    const supabase = await createServerSupabaseClient()

    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('bulk_enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        console.error('Job not found:', jobError)
        return { hasMore: false, completed: false }
      }

      // If job is pending, mark it as running and send start notification
      if (job.status === 'pending') {
        await this.updateJobStatus(jobId, 'running')
        await this.createNotification(job.user_id, {
          type: 'enrichment_started',
          title: 'Contact Enrichment Started',
          message: `Enriching ${job.contact_ids.length} contacts in the background`,
          data: {
            job_id: jobId,
            total_contacts: job.contact_ids.length
          }
        })
      }

      // If job is not running, don't process
      if (job.status !== 'running' && job.status !== 'pending') {
        console.log(`Job ${jobId} is ${job.status}, skipping processing`)
        return { hasMore: false, completed: job.status === 'completed' }
      }

      const progress = job.progress as any || { total: 0, completed: 0, failed: 0, current_batch: 1 }
      const batchSize = (job.options as any)?.batch_size || 3

      // Calculate which contacts to process in this batch
      const startIndex = progress.completed + progress.failed
      const endIndex = Math.min(startIndex + batchSize, job.contact_ids.length)
      const contactsToProcess = job.contact_ids.slice(startIndex, endIndex)

      if (contactsToProcess.length === 0) {
        // All contacts processed - mark as completed
        await this.updateJobStatus(jobId, 'completed')
        await this.createNotification(job.user_id, {
          type: 'enrichment_completed',
          title: 'Contact Enrichment Completed',
          message: `Successfully enriched ${progress.completed} contacts${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`,
          data: {
            job_id: jobId,
            total_completed: progress.completed,
            total_failed: progress.failed,
            total_contacts: job.contact_ids.length
          }
        })
        return { hasMore: false, completed: true }
      }

      console.log(`📦 Processing batch: contacts ${startIndex + 1}-${endIndex} of ${job.contact_ids.length}`)

      // Process this batch
      const batchResults = await this.processBatch(jobId, contactsToProcess, job.user_id, job.options)

      // Update progress
      const batchCompleted = batchResults.filter(r => r.success).length
      const batchFailed = batchResults.filter(r => !r.success).length

      await this.updateJobProgress(jobId, {
        completed: progress.completed + batchCompleted,
        failed: progress.failed + batchFailed,
        current_batch: progress.current_batch + 1
      })

      const hasMore = endIndex < job.contact_ids.length

      // If there are more contacts to process, trigger the next batch
      if (hasMore) {
        console.log(`🔄 Triggering next batch for job ${jobId}`)
        const processorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pitchdonkey.vercel.app'}/api/contacts/bulk-enrich/process`
        fetch(processorUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId })
        }).catch(err => {
          console.error('Failed to trigger next batch:', err)
        })
      } else {
        // No more contacts - mark job as completed
        const finalProgress = {
          ...(job.progress as any),
          completed: progress.completed + batchCompleted,
          failed: progress.failed + batchFailed
        }

        console.log(`🎉 Job ${jobId} completed: ${finalProgress.completed}/${job.contact_ids.length} successful, ${finalProgress.failed} failed`)

        await this.updateJobStatus(jobId, 'completed')
        await this.createNotification(job.user_id, {
          type: 'enrichment_completed',
          title: 'Contact Enrichment Completed',
          message: `Successfully enriched ${finalProgress.completed} contacts${finalProgress.failed > 0 ? ` (${finalProgress.failed} failed)` : ''}`,
          data: {
            job_id: jobId,
            total_completed: finalProgress.completed,
            total_failed: finalProgress.failed,
            total_contacts: job.contact_ids.length
          }
        })
      }

      return { hasMore, completed: !hasMore }

    } catch (error) {
      console.error('Batch processing failed:', error)
      await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')

      const job = await this.getJobDetails(jobId)
      if (job) {
        await this.createNotification(job.user_id, {
          type: 'enrichment_failed',
          title: 'Contact Enrichment Failed',
          message: `Enrichment job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: {
            job_id: jobId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }

      return { hasMore: false, completed: false }
    }
  }

  /**
   * Process a bulk enrichment job (deprecated - use processNextBatch for serverless)
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

      // Create start notification
      await this.createNotification(job.user_id, {
        type: 'enrichment_started',
        title: 'Contact Enrichment Started',
        message: `Enriching ${job.contact_ids.length} contacts in the background`,
        data: {
          job_id: jobId,
          total_contacts: job.contact_ids.length
        }
      })

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

      // Create completion notification
      await this.createNotification(job.user_id, {
        type: 'enrichment_completed',
        title: 'Contact Enrichment Completed',
        message: `Successfully enriched ${totalCompleted} contacts${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`,
        data: {
          job_id: jobId,
          total_completed: totalCompleted,
          total_failed: totalFailed,
          total_contacts: job.contact_ids.length
        }
      })

    } catch (error) {
      console.error('Bulk enrichment job processing failed:', error)
      await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')

      // Create failure notification
      const job = await this.getJobDetails(jobId)
      if (job) {
        await this.createNotification(job.user_id, {
          type: 'enrichment_failed',
          title: 'Contact Enrichment Failed',
          message: `Enrichment job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: {
            job_id: jobId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
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
          .select('id, email, website, linkedin_url, enrichment_status, linkedin_extraction_status')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()

        if (!contact) {
          throw new Error('Contact not found')
        }

        // Determine enrichment strategy based on available sources
        let result
        const hasWebsite = !!contact.website
        const hasLinkedIn = !!contact.linkedin_url
        const hasBizEmail = hasBusinessEmail(contact.email)
        const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
        const isWebsiteEnriched = contact.enrichment_status === 'completed'

        console.log(`📊 Contact ${contactId} sources:`, {
          website: hasWebsite,
          linkedin: hasLinkedIn,
          businessEmail: hasBizEmail,
          linkedinEnriched: isLinkedInEnriched,
          websiteEnriched: isWebsiteEnriched
        })

        if (hasWebsite || hasBizEmail) {
          // Has website or business email - use traditional enrichment
          console.log(`🌐 Using website enrichment for contact ${contactId}`)
          result = await this.enrichmentService.enrichContact(contactId, userId)
        } else if (hasLinkedIn) {
          // LinkedIn-only - use smart enrichment orchestrator
          console.log(`🔗 Using LinkedIn-only enrichment for contact ${contactId}`)
          result = await this.smartOrchestrator.enrichContact(contactId, userId)
        } else {
          throw new Error('Contact has no website, LinkedIn URL, or business email for enrichment')
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
      const hasBizEmail = hasBusinessEmail(contact.email)
      const canEnrichFromEmail = !hasWebsite && hasBizEmail // Can derive website from business email

      const isWebsiteEnriched = contact.enrichment_status === 'completed' && this.isRecentlyEnriched(contact.enrichment_updated_at)
      const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed' && this.isRecentlyEnriched(contact.linkedin_extracted_at)
      const isProcessing = contact.enrichment_status === 'pending' || contact.linkedin_extraction_status === 'pending'

      if (isProcessing) {
        processing.push({
          id: contact.id,
          email: contact.email,
          status: contact.enrichment_status || contact.linkedin_extraction_status
        })
      } else if (!hasWebsite && !hasLinkedIn && !canEnrichFromEmail) {
        // No sources available for enrichment (no website, LinkedIn, or business email)
        no_sources.push({
          id: contact.id,
          email: contact.email,
          company: contact.company
        })
      } else if (isWebsiteEnriched && isLinkedInEnriched) {
        // Both sources already enriched recently
        already_enriched.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          last_enriched: contact.enrichment_updated_at || contact.linkedin_extracted_at
        })
      } else if ((hasWebsite || canEnrichFromEmail) && !isWebsiteEnriched) {
        // Has website OR business email, and website not recently enriched - eligible for website enrichment
        eligible.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          website: contact.website || `https://www.${extractDomainFromEmail(contact.email)}`
        })
      } else if (hasLinkedIn && !isLinkedInEnriched) {
        // Has LinkedIn and LinkedIn not recently enriched - eligible for LinkedIn enrichment
        linkedin_only.push({
          id: contact.id,
          email: contact.email,
          company: contact.company,
          linkedin_url: contact.linkedin_url
        })
      } else {
        // Edge case: only one source enriched recently, but still has other sources available
        if (hasWebsite || canEnrichFromEmail) {
          eligible.push({
            id: contact.id,
            email: contact.email,
            company: contact.company,
            website: contact.website || `https://www.${extractDomainFromEmail(contact.email)}`
          })
        } else if (hasLinkedIn) {
          linkedin_only.push({
            id: contact.id,
            email: contact.email,
            company: contact.company,
            linkedin_url: contact.linkedin_url
          })
        }
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

  /**
   * Get job details for notifications
   */
  private async getJobDetails(jobId: string): Promise<{ user_id: string } | null> {
    const supabase = await createServerSupabaseClient()

    const { data: job } = await supabase
      .from('bulk_enrichment_jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    return job
  }

  /**
   * Create a notification for the user
   */
  private async createNotification(userId: string, notification: {
    type: string
    title: string
    message: string
    data?: any
  }): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient()

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data || {}
        })

      if (error) {
        console.error('Failed to create notification:', error)
      } else {
        console.log(`✅ Created notification for user ${userId}: ${notification.title}`)
      }
    } catch (error) {
      console.error('Error creating notification:', error)
    }
  }
}