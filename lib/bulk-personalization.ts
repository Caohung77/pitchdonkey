import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { AIPersonalizationService, PersonalizationRequest } from './ai-providers'

export interface BulkPersonalizationJob {
  id: string
  user_id: string
  name: string
  description?: string
  template_id?: string
  custom_prompt?: string
  contact_ids: string[]
  variables: Record<string, string>
  ai_provider: 'openai' | 'anthropic'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
  results: BulkPersonalizationResult[]
  estimated_cost: number
  actual_cost: number
  estimated_tokens: number
  actual_tokens: number
  error_message?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface BulkPersonalizationResult {
  contact_id: string
  contact_name: string
  contact_email: string
  personalized_content: string
  confidence_score: number
  tokens_used: number
  processing_time: number
  status: 'success' | 'failed'
  error_message?: string
}

export class BulkPersonalizationService {
  private supabase = createClientComponentClient()
  private aiService = new AIPersonalizationService()
  private activeJobs = new Map<string, AbortController>()

  /**
   * Create a new bulk personalization job
   */
  async createJob(
    userId: string,
    jobData: {
      name: string
      description?: string
      template_id?: string
      custom_prompt?: string
      contact_ids: string[]
      variables: Record<string, string>
      ai_provider: 'openai' | 'anthropic'
    },
    supabaseClient?: any
  ): Promise<BulkPersonalizationJob> {
    const client = supabaseClient || this.supabase
    if (!client) {
      throw new Error('Supabase client not available')
    }

    // Estimate cost and tokens
    const contentLength = jobData.template_id ? 500 : (jobData.custom_prompt?.length || 0)
    const estimatedTokens = Math.ceil((contentLength + 200) * jobData.contact_ids.length * 1.5)
    const estimatedCost = this.aiService.estimateCost(estimatedTokens, jobData.ai_provider)

    const job: Omit<BulkPersonalizationJob, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      name: jobData.name,
      description: jobData.description,
      template_id: jobData.template_id,
      custom_prompt: jobData.custom_prompt,
      contact_ids: jobData.contact_ids,
      variables: jobData.variables,
      ai_provider: jobData.ai_provider,
      status: 'pending',
      progress: {
        total: jobData.contact_ids.length,
        completed: 0,
        failed: 0,
        current_batch: 0
      },
      results: [],
      estimated_cost: estimatedCost,
      actual_cost: 0,
      estimated_tokens: estimatedTokens,
      actual_tokens: 0
    }

    const { data: createdJob, error: createError } = await client
      .from('bulk_personalization_jobs')
      .insert(job)
      .select()
      .single()

    if (createError || !createdJob) {
      throw new Error('Failed to create job')
    }

    return createdJob
  }

  /**
   * Start processing a bulk personalization job
   */
  async processJob(
    jobId: string,
    supabaseClient?: any,
    onProgress?: (progress: { completed: number; total: number; currentBatch: number }) => void
  ): Promise<void> {
    const client = supabaseClient || this.supabase
    if (!client) {
      throw new Error('Supabase client not available')
    }

    // Get job details
    const { data: job, error: jobError } = await client
      .from('bulk_personalization_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job not found')
    }

    if (job.status !== 'pending') {
      throw new Error(`Job is not in pending status: ${job.status}`)
    }

    // Create abort controller for this job
    const abortController = new AbortController()
    this.activeJobs.set(jobId, abortController)

    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', {
        started_at: new Date().toISOString()
      }, client)

      // Get contacts
      const { data: contacts, error: contactsError } = await client
        .from('contacts')
        .select('id, first_name, last_name, email, company_name, job_title, industry, website, custom_fields')
        .in('id', job.contact_ids)
        .eq('user_id', job.user_id)

      if (contactsError || !contacts) {
        throw new Error('Failed to fetch contacts')
      }

      // Get template content
      let templateContent = ''
      if (job.template_id) {
        const { data: template, error: templateError } = await client
          .from('ai_templates')
          .select('content')
          .eq('id', job.template_id)
          .eq('user_id', job.user_id)
          .single()

        if (templateError || !template) {
          throw new Error('Template not found')
        }
        templateContent = template.content
      } else {
        templateContent = job.custom_prompt
      }

      // Process in batches
      const batchSize = 10 // Default batch size
      const delayBetweenBatches = 1000 // 1 second delay
      const results: BulkPersonalizationResult[] = []
      let totalTokens = 0
      let totalCost = 0

      for (let i = 0; i < contacts.length; i += batchSize) {
        // Check if job was cancelled
        if (abortController.signal.aborted) {
          throw new Error('Job was cancelled')
        }

        const batch = contacts.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1

        // Update progress
        await this.updateJobProgress(jobId, {
          current_batch: batchNumber,
          completed: results.length
        }, client)

        if (onProgress) {
          onProgress({
            completed: results.length,
            total: contacts.length,
            currentBatch: batchNumber
          })
        }

        // Create personalization requests for batch
        const batchRequests: PersonalizationRequest[] = batch.map(contact => ({
          contactData: {
            first_name: contact.first_name,
            last_name: contact.last_name,
            company_name: contact.company_name,
            job_title: contact.job_title,
            industry: contact.industry,
            website: contact.website,
            custom_fields: contact.custom_fields
          },
          templateContent,
          customPrompt: job.custom_prompt,
          variables: job.variables,
          provider: job.ai_provider
        }))

        try {
          // Process batch
          const batchResults = await this.aiService.bulkPersonalize(batchRequests)

          // Convert to bulk results format
          const formattedResults: BulkPersonalizationResult[] = batchResults.map((result, index) => {
            const contact = batch[index]
            totalTokens += result.tokensUsed
            
            // Calculate cost based on provider
            const provider = AIPersonalizationService.getProvider(job.ai_provider)
            if (provider) {
              const inputTokens = Math.ceil(result.tokensUsed * 0.6) // Rough estimate
              const outputTokens = Math.ceil(result.tokensUsed * 0.4)
              const cost = (inputTokens / 1000) * provider.pricing.inputTokens + 
                          (outputTokens / 1000) * provider.pricing.outputTokens
              totalCost += cost
            }

            return {
              contact_id: contact.id,
              contact_name: `${contact.first_name} ${contact.last_name}`,
              contact_email: contact.email,
              personalized_content: result.personalizedContent,
              confidence_score: result.confidence,
              tokens_used: result.tokensUsed,
              processing_time: result.processingTime,
              status: 'success' as const,
              error_message: (result as any).error
            }
          })

          results.push(...formattedResults)

          // Save batch results to database
          await this.saveBatchResults(jobId, formattedResults, client)

        } catch (error) {
          console.error(`Batch ${batchNumber} failed:`, error)
          
          // Create failed results for this batch
          const failedResults: BulkPersonalizationResult[] = batch.map(contact => ({
            contact_id: contact.id,
            contact_name: `${contact.first_name} ${contact.last_name}`,
            contact_email: contact.email,
            personalized_content: templateContent, // Use original template
            confidence_score: 0,
            tokens_used: 0,
            processing_time: 0,
            status: 'failed' as const,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          }))

          results.push(...failedResults)
          await this.saveBatchResults(jobId, failedResults, client)
        }

        // Add delay between batches (except for last batch)
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
        }
      }

      // Update final job status
      const successCount = results.filter(r => r.status === 'success').length
      const failedCount = results.filter(r => r.status === 'failed').length

      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
        progress: {
          total: contacts.length,
          completed: successCount,
          failed: failedCount,
          current_batch: Math.ceil(contacts.length / batchSize)
        },
        actual_tokens: totalTokens,
        actual_cost: Math.round(totalCost * 100) / 100
      }, client)

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)
      
      await this.updateJobStatus(jobId, 'failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      }, client)
      
      throw error
    } finally {
      // Clean up abort controller
      this.activeJobs.delete(jobId)
    }
  }

  // Private helper methods
  private async updateJobStatus(
    jobId: string,
    status: BulkPersonalizationJob['status'],
    updates: Partial<BulkPersonalizationJob> = {},
    client: any
  ): Promise<void> {
    const { error } = await client
      .from('bulk_personalization_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...updates
      })
      .eq('id', jobId)

    if (error) {
      console.error('Failed to update job status:', error)
    }
  }

  private async updateJobProgress(
    jobId: string,
    progress: Partial<BulkPersonalizationJob['progress']>,
    client: any
  ): Promise<void> {
    const { error } = await client
      .from('bulk_personalization_jobs')
      .update({
        progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (error) {
      console.error('Failed to update job progress:', error)
    }
  }

  private async saveBatchResults(
    jobId: string,
    results: BulkPersonalizationResult[],
    client: any
  ): Promise<void> {
    const records = results.map(result => ({
      job_id: jobId,
      ...result
    }))

    const { error } = await client
      .from('bulk_personalization_results')
      .insert(records)

    if (error) {
      console.error('Failed to save batch results:', error)
    }
  }
}

// Utility functions for job management
export const BulkPersonalizationUtils = {
  /**
   * Format job duration
   */
  formatDuration(startTime: string, endTime?: string): string {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  },

  /**
   * Calculate progress percentage
   */
  calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  },

  /**
   * Format cost
   */
  formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`
  },

  /**
   * Format token count
   */
  formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  },

  /**
   * Get status color
   */
  getStatusColor(status: BulkPersonalizationJob['status']): string {
    switch (status) {
      case 'pending': return 'gray'
      case 'processing': return 'blue'
      case 'completed': return 'green'
      case 'failed': return 'red'
      case 'cancelled': return 'orange'
      default: return 'gray'
    }
  },

  /**
   * Get status icon
   */
  getStatusIcon(status: BulkPersonalizationJob['status']): string {
    switch (status) {
      case 'pending': return '⏳'
      case 'processing': return '⚡'
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'cancelled': return '⏹️'
      default: return '❓'
    }
  }
}