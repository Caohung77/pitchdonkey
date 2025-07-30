import { BulkPersonalizationService, BulkPersonalizationUtils } from '@/lib/bulk-personalization'
import { AIPersonalizationService } from '@/lib/ai-providers'

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        in: jest.fn(() => ({
          eq: jest.fn()
        }))
      })),
      in: jest.fn(() => ({
        eq: jest.fn()
      })),
      order: jest.fn(() => ({
        eq: jest.fn(),
        filter: jest.fn(),
        limit: jest.fn(),
        range: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
}

// Mock AI service
jest.mock('@/lib/ai-providers', () => ({
  AIPersonalizationService: {
    getUsageEstimate: jest.fn(() => ({
      estimatedTokens: 1000,
      estimatedCost: 0.05
    })),
    getProvider: jest.fn(() => ({
      pricing: {
        inputTokens: 0.01,
        outputTokens: 0.03
      }
    }))
  }
}))

describe('BulkPersonalizationService', () => {
  let service: BulkPersonalizationService
  
  beforeEach(() => {
    service = new BulkPersonalizationService()
    jest.clearAllMocks()
  })

  describe('createJob', () => {
    const mockContacts = [
      {
        id: 'contact-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        company_name: 'Acme Corp',
        job_title: 'CEO',
        industry: 'Technology',
        website: 'https://acme.com',
        custom_fields: {}
      },
      {
        id: 'contact-2',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        company_name: 'Tech Inc',
        job_title: 'CTO',
        industry: 'Technology',
        website: 'https://techinc.com',
        custom_fields: {}
      }
    ]

    const mockTemplate = {
      content: 'Hello {{first_name}}, I hope this email finds you well.',
      name: 'Cold Outreach Template'
    }

    const validRequest = {
      name: 'Test Job',
      template_id: 'template-123',
      contact_ids: ['contact-1', 'contact-2'],
      ai_provider: 'openai' as const,
      ai_model: 'gpt-4',
      variables: { company_focus: 'AI solutions' }
    }

    beforeEach(() => {
      // Mock successful contact fetch
      mockSupabaseClient.from().select().in().eq.mockResolvedValue({
        data: mockContacts,
        error: null
      })

      // Mock successful template fetch
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockTemplate,
        error: null
      })

      // Mock successful job creation
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'job-123',
          user_id: 'user-123',
          ...validRequest,
          status: 'pending',
          progress: { total: 2, completed: 0, failed: 0, current_batch: 0 },
          estimated_cost: 0.05,
          actual_cost: 0,
          estimated_tokens: 1000,
          actual_tokens: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      })
    })

    it('should create a job successfully with template', async () => {
      const job = await service.createJob('user-123', validRequest, mockSupabaseClient)

      expect(job).toBeDefined()
      expect(job.id).toBe('job-123')
      expect(job.name).toBe('Test Job')
      expect(job.status).toBe('pending')
      expect(job.progress.total).toBe(2)
      expect(job.estimated_cost).toBe(0.05)
      expect(job.estimated_tokens).toBe(1000)
    })

    it('should create a job successfully with custom prompt', async () => {
      const customPromptRequest = {
        ...validRequest,
        template_id: undefined,
        custom_prompt: 'Custom personalization prompt for {{first_name}}'
      }

      const job = await service.createJob('user-123', customPromptRequest, mockSupabaseClient)

      expect(job).toBeDefined()
      expect(job.custom_prompt).toBe('Custom personalization prompt for {{first_name}}')
    })

    it('should throw error if no contacts found', async () => {
      mockSupabaseClient.from().select().in().eq.mockResolvedValue({
        data: [],
        error: null
      })

      await expect(
        service.createJob('user-123', validRequest, mockSupabaseClient)
      ).rejects.toThrow('No valid contacts found')
    })

    it('should throw error if template not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      await expect(
        service.createJob('user-123', validRequest, mockSupabaseClient)
      ).rejects.toThrow('Template not found')
    })

    it('should validate contact count limits', async () => {
      const tooManyContactsRequest = {
        ...validRequest,
        contact_ids: Array.from({ length: 1001 }, (_, i) => `contact-${i}`)
      }

      await expect(
        service.createJob('user-123', tooManyContactsRequest, mockSupabaseClient)
      ).rejects.toThrow()
    })
  })

  describe('processJob', () => {
    const mockJob = {
      id: 'job-123',
      user_id: 'user-123',
      name: 'Test Job',
      status: 'pending',
      template_id: 'template-123',
      custom_prompt: null,
      contact_ids: ['contact-1', 'contact-2'],
      ai_provider: 'openai',
      ai_model: 'gpt-4',
      variables: {},
      progress: { total: 2, completed: 0, failed: 0, current_batch: 0 },
      estimated_cost: 0.05,
      actual_cost: 0,
      estimated_tokens: 1000,
      actual_tokens: 0
    }

    const mockContacts = [
      {
        id: 'contact-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        company_name: 'Acme Corp',
        job_title: 'CEO',
        industry: 'Technology',
        website: 'https://acme.com',
        custom_fields: {}
      },
      {
        id: 'contact-2',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        company_name: 'Tech Inc',
        job_title: 'CTO',
        industry: 'Technology',
        website: 'https://techinc.com',
        custom_fields: {}
      }
    ]

    const mockTemplate = {
      content: 'Hello {{first_name}}, I hope this email finds you well.'
    }

    beforeEach(() => {
      // Mock job fetch
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockJob,
        error: null
      })

      // Mock contacts fetch
      mockSupabaseClient.from().select().in().eq.mockResolvedValue({
        data: mockContacts,
        error: null
      })

      // Mock template fetch
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockTemplate,
        error: null
      })

      // Mock job status updates
      mockSupabaseClient.from().update().eq.mockResolvedValue({
        error: null
      })

      // Mock results insertion
      mockSupabaseClient.from().insert.mockResolvedValue({
        error: null
      })

      // Mock AI service
      const mockAIService = {
        bulkPersonalize: jest.fn().mockResolvedValue([
          {
            personalizedContent: 'Hello John, I hope this email finds you well.',
            tokensUsed: 50,
            confidence: 0.85,
            provider: 'openai',
            processingTime: 1500
          },
          {
            personalizedContent: 'Hello Jane, I hope this email finds you well.',
            tokensUsed: 52,
            confidence: 0.88,
            provider: 'openai',
            processingTime: 1600
          }
        ])
      }

      service['aiService'] = mockAIService as any
    })

    it('should process job successfully', async () => {
      const progressCallback = jest.fn()

      await service.processJob('job-123', mockSupabaseClient, progressCallback)

      // Verify progress callback was called
      expect(progressCallback).toHaveBeenCalledWith({
        completed: expect.any(Number),
        total: 2,
        currentBatch: 1
      })

      // Verify job status was updated to processing
      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
          started_at: expect.any(String)
        })
      )

      // Verify final status update to completed
      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String)
        })
      )
    })

    it('should handle AI service failures gracefully', async () => {
      const mockAIService = {
        bulkPersonalize: jest.fn().mockRejectedValue(new Error('AI service error'))
      }
      service['aiService'] = mockAIService as any

      await service.processJob('job-123', mockSupabaseClient)

      // Verify job status was updated to failed
      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: expect.stringContaining('AI service error')
        })
      )
    })

    it('should throw error if job not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      await expect(
        service.processJob('nonexistent-job', mockSupabaseClient)
      ).rejects.toThrow('Job not found')
    })

    it('should throw error if job not in pending status', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ...mockJob, status: 'completed' },
        error: null
      })

      await expect(
        service.processJob('job-123', mockSupabaseClient)
      ).rejects.toThrow('Job is not in pending status: completed')
    })
  })

  describe('cancelJob', () => {
    it('should cancel job successfully', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({
        error: null
      })

      await service.cancelJob('job-123', mockSupabaseClient)

      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          completed_at: expect.any(String)
        })
      )
    })
  })

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'Test Job',
        status: 'completed'
      }

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockJob,
        error: null
      })

      const job = await service.getJobStatus('job-123', mockSupabaseClient)

      expect(job).toEqual(mockJob)
    })

    it('should return null if job not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      const job = await service.getJobStatus('nonexistent-job', mockSupabaseClient)

      expect(job).toBeNull()
    })
  })

  describe('exportJobResults', () => {
    it('should export results as CSV', async () => {
      const mockResults = [
        {
          contact_name: 'John Doe',
          contact_email: 'john@example.com',
          personalized_content: 'Hello John, how are you?',
          confidence_score: 0.85,
          tokens_used: 50,
          processing_time: 1500,
          status: 'success',
          error_message: null
        },
        {
          contact_name: 'Jane Smith',
          contact_email: 'jane@example.com',
          personalized_content: 'Hi Jane, hope you are well.',
          confidence_score: 0.88,
          tokens_used: 52,
          processing_time: 1600,
          status: 'success',
          error_message: null
        }
      ]

      // Mock getJobResults method
      service.getJobResults = jest.fn().mockResolvedValue({
        results: mockResults,
        total: 2
      })

      const csv = await service.exportJobResults('job-123', mockSupabaseClient)

      expect(csv).toContain('Contact Name,Contact Email,Personalized Content')
      expect(csv).toContain('\"John Doe\",\"john@example.com\"')
      expect(csv).toContain('\"Jane Smith\",\"jane@example.com\"')
      expect(csv.split('\\n')).toHaveLength(3) // Header + 2 data rows
    })

    it('should throw error if no results to export', async () => {
      service.getJobResults = jest.fn().mockResolvedValue({
        results: [],
        total: 0
      })

      await expect(
        service.exportJobResults('job-123', mockSupabaseClient)
      ).rejects.toThrow('No results to export')
    })
  })
})

describe('BulkPersonalizationUtils', () => {
  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      const start = '2024-01-01T10:00:00Z'
      const end = '2024-01-01T10:02:30Z'

      const duration = BulkPersonalizationUtils.formatDuration(start, end)
      expect(duration).toBe('2m 30s')
    })

    it('should format seconds only', () => {
      const start = '2024-01-01T10:00:00Z'
      const end = '2024-01-01T10:00:45Z'

      const duration = BulkPersonalizationUtils.formatDuration(start, end)
      expect(duration).toBe('45s')
    })

    it('should handle missing start time', () => {
      const duration = BulkPersonalizationUtils.formatDuration()
      expect(duration).toBe('Not started')
    })
  })

  describe('calculateProgress', () => {
    it('should calculate progress percentage', () => {
      expect(BulkPersonalizationUtils.calculateProgress(25, 100)).toBe(25)
      expect(BulkPersonalizationUtils.calculateProgress(0, 100)).toBe(0)
      expect(BulkPersonalizationUtils.calculateProgress(100, 100)).toBe(100)
    })

    it('should handle zero total', () => {
      expect(BulkPersonalizationUtils.calculateProgress(0, 0)).toBe(0)
    })
  })

  describe('formatCost', () => {
    it('should format cost with 4 decimal places', () => {
      expect(BulkPersonalizationUtils.formatCost(0.05)).toBe('$0.0500')
      expect(BulkPersonalizationUtils.formatCost(1.2345)).toBe('$1.2345')
      expect(BulkPersonalizationUtils.formatCost(0)).toBe('$0.0000')
    })
  })

  describe('formatTokens', () => {
    it('should format large token counts', () => {
      expect(BulkPersonalizationUtils.formatTokens(1500000)).toBe('1.5M')
      expect(BulkPersonalizationUtils.formatTokens(2500)).toBe('2.5K')
      expect(BulkPersonalizationUtils.formatTokens(500)).toBe('500')
    })
  })

  describe('getStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(BulkPersonalizationUtils.getStatusColor('pending')).toBe('gray')
      expect(BulkPersonalizationUtils.getStatusColor('processing')).toBe('blue')
      expect(BulkPersonalizationUtils.getStatusColor('completed')).toBe('green')
      expect(BulkPersonalizationUtils.getStatusColor('failed')).toBe('red')
      expect(BulkPersonalizationUtils.getStatusColor('cancelled')).toBe('orange')
    })
  })

  describe('getStatusIcon', () => {
    it('should return correct icons for each status', () => {
      expect(BulkPersonalizationUtils.getStatusIcon('pending')).toBe('⏳')
      expect(BulkPersonalizationUtils.getStatusIcon('processing')).toBe('⚡')
      expect(BulkPersonalizationUtils.getStatusIcon('completed')).toBe('✅')
      expect(BulkPersonalizationUtils.getStatusIcon('failed')).toBe('❌')
      expect(BulkPersonalizationUtils.getStatusIcon('cancelled')).toBe('⏹️')
    })
  })
})"