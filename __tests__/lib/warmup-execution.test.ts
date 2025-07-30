import { WarmupExecutor, WarmupJob, WarmupEmail } from '../../lib/warmup-execution'
import { WarmupSystem } from '../../lib/warmup-system'
import { RateLimiter } from '../../lib/rate-limiter'
import { TimezoneScheduler } from '../../lib/timezone-scheduler'

// Mock dependencies
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } })),
        order: jest.fn(() => ({ data: [], error: null }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({ data: mockWarmupJob, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ error: null }))
    })),
    raw: jest.fn((query) => query)
  }))
}

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(() => [])
}

const mockWarmupSystem = {
  updateWarmupMetrics: jest.fn(),
  pauseWarmup: jest.fn()
}

const mockRateLimiter = {
  checkSendingQuota: jest.fn(() => ({
    account_id: 'account-1',
    daily_remaining: 30,
    hourly_remaining: 10,
    domain_limits: { 'warmup.test': 10 },
    is_available: true,
    burst_available: 5
  }))
}

const mockTimezoneScheduler = {
  calculateOptimalScheduleTime: jest.fn()
}

const mockEmailService = {
  send: jest.fn(() => ({
    success: true,
    trackingPixelId: 'track_123'
  }))
}

const mockWarmupJob: WarmupJob = {
  id: 'job-1',
  warmup_plan_id: 'plan-1',
  email_account_id: 'account-1',
  scheduled_date: '2024-01-15',
  target_emails: 10,
  status: 'pending',
  emails_sent: 0,
  emails_delivered: 0,
  emails_opened: 0,
  emails_replied: 0,
  emails_bounced: 0,
  spam_complaints: 0,
  execution_log: [],
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z'
}

const mockWarmupPlan = {
  id: 'plan-1',
  user_id: 'user-1',
  email_account_id: 'account-1',
  strategy: 'moderate',
  status: 'active',
  current_week: 1,
  total_weeks: 3,
  daily_target: 10,
  settings: {
    max_bounce_rate: 0.05,
    max_spam_rate: 0.003,
    business_hours_only: true
  },
  metrics: {
    bounce_rate: 0.02,
    spam_rate: 0.001,
    delivery_rate: 0.95
  }
}

describe('WarmupExecutor', () => {
  let warmupExecutor: WarmupExecutor

  beforeEach(() => {
    warmupExecutor = new WarmupExecutor(
      mockSupabase,
      mockRedis,
      mockWarmupSystem as any,
      mockRateLimiter as any,
      mockTimezoneScheduler as any,
      mockEmailService
    )
    jest.clearAllMocks()
  })

  describe('scheduleDailyWarmupJobs', () => {
    it('should schedule jobs for all active warmup plans', async () => {
      const activePlans = [
        { ...mockWarmupPlan, id: 'plan-1' },
        { ...mockWarmupPlan, id: 'plan-2' }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: activePlans, error: null }))
        }))
      })

      // Mock no existing jobs
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        }))
      })

      // Mock job creation
      jest.spyOn(warmupExecutor, 'createWarmupJob').mockResolvedValue(mockWarmupJob)

      await warmupExecutor.scheduleDailyWarmupJobs()

      expect(warmupExecutor.createWarmupJob).toHaveBeenCalledTimes(2)
    })

    it('should skip plans that already have jobs scheduled', async () => {
      const activePlans = [mockWarmupPlan]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: activePlans, error: null }))
        }))
      })

      // Mock existing job
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: { id: 'existing-job' }, error: null }))
            }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor, 'createWarmupJob').mockResolvedValue(mockWarmupJob)

      await warmupExecutor.scheduleDailyWarmupJobs()

      expect(warmupExecutor.createWarmupJob).not.toHaveBeenCalled()
    })

    it('should handle no active plans', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: [], error: null }))
        }))
      })

      jest.spyOn(warmupExecutor, 'createWarmupJob').mockResolvedValue(mockWarmupJob)

      await warmupExecutor.scheduleDailyWarmupJobs()

      expect(warmupExecutor.createWarmupJob).not.toHaveBeenCalled()
    })
  })

  describe('createWarmupJob', () => {
    it('should create a warmup job with correct target emails', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupJob, error: null }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor, 'generateWarmupEmails').mockResolvedValue()

      const job = await warmupExecutor.createWarmupJob(mockWarmupPlan as any, '2024-01-15')

      expect(job.target_emails).toBe(mockWarmupPlan.daily_target)
      expect(job.status).toBe('pending')
      expect(warmupExecutor.generateWarmupEmails).toHaveBeenCalledWith(mockWarmupJob)
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      })

      await expect(warmupExecutor.createWarmupJob(mockWarmupPlan as any, '2024-01-15'))
        .rejects.toThrow('Database error')
    })
  })

  describe('generateWarmupEmails', () => {
    it('should generate emails with proper distribution', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      // Mock addJobLog
      jest.spyOn(warmupExecutor as any, 'addJobLog').mockResolvedValue()

      await warmupExecutor.generateWarmupEmails(mockWarmupJob)

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_emails')
    })

    it('should handle missing warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor as any, 'addJobLog').mockResolvedValue()

      await expect(warmupExecutor.generateWarmupEmails(mockWarmupJob))
        .rejects.toThrow('Warmup plan not found')
    })
  })

  describe('executeWarmupJobs', () => {
    it('should execute all pending jobs for today', async () => {
      const pendingJobs = [
        { ...mockWarmupJob, id: 'job-1' },
        { ...mockWarmupJob, id: 'job-2' }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: pendingJobs, error: null }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor, 'executeWarmupJob').mockResolvedValue()

      await warmupExecutor.executeWarmupJobs()

      expect(warmupExecutor.executeWarmupJob).toHaveBeenCalledTimes(2)
    })

    it('should handle no pending jobs', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor, 'executeWarmupJob').mockResolvedValue()

      await warmupExecutor.executeWarmupJobs()

      expect(warmupExecutor.executeWarmupJob).not.toHaveBeenCalled()
    })
  })

  describe('executeWarmupJob', () => {
    it('should execute job and send emails successfully', async () => {
      const mockEmails = [
        {
          id: 'email-1',
          warmup_job_id: 'job-1',
          recipient_email: 'test@example.com',
          status: 'pending',
          interaction_simulated: false
        },
        {
          id: 'email-2',
          warmup_job_id: 'job-1',
          recipient_email: 'test2@example.com',
          status: 'pending',
          interaction_simulated: true,
          simulation_type: 'open'
        }
      ]

      // Mock job status update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      // Mock get emails
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({ data: mockEmails, error: null }))
            }))
          }))
        }))
      })

      // Mock other database operations
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      jest.spyOn(warmupExecutor as any, 'addJobLog').mockResolvedValue()
      jest.spyOn(warmupExecutor, 'sendWarmupEmail').mockResolvedValue({
        success: true,
        delivered: true
      })
      jest.spyOn(warmupExecutor, 'scheduleInteractionSimulation').mockResolvedValue()
      jest.spyOn(warmupExecutor as any, 'completeWarmupJob').mockResolvedValue()
      jest.spyOn(warmupExecutor as any, 'delay').mockResolvedValue()

      await warmupExecutor.executeWarmupJob(mockWarmupJob)

      expect(warmupExecutor.sendWarmupEmail).toHaveBeenCalledTimes(2)
      expect(warmupExecutor.scheduleInteractionSimulation).toHaveBeenCalledTimes(1)
      expect(mockWarmupSystem.updateWarmupMetrics).toHaveBeenCalled()
    })

    it('should handle rate limit exceeded', async () => {
      const mockEmails = [{ id: 'email-1', status: 'pending' }]

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({ data: mockEmails, error: null }))
            }))
          }))
        }))
      })

      // Mock rate limit exceeded
      mockRateLimiter.checkSendingQuota.mockResolvedValueOnce({
        account_id: 'account-1',
        is_available: false,
        daily_remaining: 0
      })

      jest.spyOn(warmupExecutor as any, 'addJobLog').mockResolvedValue()
      jest.spyOn(warmupExecutor as any, 'rescheduleEmails').mockResolvedValue()

      await warmupExecutor.executeWarmupJob(mockWarmupJob)

      expect(warmupExecutor.sendWarmupEmail).not.toHaveBeenCalled()
      expect(warmupExecutor as any).rescheduleEmails.toHaveBeenCalledWith(mockEmails)
    })

    it('should handle no emails to send', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({ data: [], error: null }))
            }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor as any, 'addJobLog').mockResolvedValue()
      jest.spyOn(warmupExecutor as any, 'completeWarmupJob').mockResolvedValue()

      await warmupExecutor.executeWarmupJob(mockWarmupJob)

      expect(warmupExecutor as any).completeWarmupJob.toHaveBeenCalledWith('job-1', 'No emails to send')
    })
  })

  describe('sendWarmupEmail', () => {
    const mockEmail: WarmupEmail = {
      id: 'email-1',
      warmup_job_id: 'job-1',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      recipient_type: 'internal',
      content_type: 'introduction',
      subject: 'Test Subject',
      content: 'Test Content',
      scheduled_at: '2024-01-15T10:00:00Z',
      status: 'pending',
      interaction_simulated: false,
      created_at: '2024-01-15T00:00:00Z'
    }

    it('should send email successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const result = await warmupExecutor.sendWarmupEmail(mockEmail)

      expect(result.success).toBe(true)
      expect(result.delivered).toBe(true)
      expect(result.trackingPixelId).toBe('track_123')
      expect(mockEmailService.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
        trackingEnabled: true,
        warmupMode: true
      })
    })

    it('should handle email service failure', async () => {
      mockEmailService.send.mockResolvedValueOnce({
        success: false,
        error: 'SMTP connection failed'
      })

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const result = await warmupExecutor.sendWarmupEmail(mockEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMTP connection failed')
    })

    it('should handle exceptions', async () => {
      mockEmailService.send.mockRejectedValueOnce(new Error('Network error'))

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const result = await warmupExecutor.sendWarmupEmail(mockEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('scheduleInteractionSimulation', () => {
    const mockEmail: WarmupEmail = {
      id: 'email-1',
      warmup_job_id: 'job-1',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      recipient_type: 'internal',
      content_type: 'introduction',
      subject: 'Test Subject',
      content: 'Test Content',
      scheduled_at: '2024-01-15T10:00:00Z',
      status: 'sent',
      interaction_simulated: true,
      simulation_type: 'open',
      simulation_delay_hours: 3,
      created_at: '2024-01-15T00:00:00Z'
    }

    it('should schedule interaction simulation', async () => {
      await warmupExecutor.scheduleInteractionSimulation(mockEmail)

      expect(mockRedis.set).toHaveBeenCalledWith(
        'warmup_simulation:email-1',
        expect.stringContaining('"type":"open"'),
        'EX',
        24 * 60 * 60
      )
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('Redis error'))

      // Should not throw
      await expect(warmupExecutor.scheduleInteractionSimulation(mockEmail))
        .resolves.not.toThrow()
    })
  })

  describe('processInteractionSimulations', () => {
    it('should process scheduled simulations', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      
      mockRedis.keys.mockResolvedValueOnce(['warmup_simulation:email-1'])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        emailId: 'email-1',
        type: 'open',
        scheduledAt: pastTime
      }))

      jest.spyOn(warmupExecutor, 'simulateInteraction').mockResolvedValue()

      await warmupExecutor.processInteractionSimulations()

      expect(warmupExecutor.simulateInteraction).toHaveBeenCalledWith('email-1', 'open')
      expect(mockRedis.del).toHaveBeenCalledWith('warmup_simulation:email-1')
    })

    it('should skip future simulations', async () => {
      const futureTime = new Date(Date.now() + 60000).toISOString() // 1 minute from now
      
      mockRedis.keys.mockResolvedValueOnce(['warmup_simulation:email-1'])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        emailId: 'email-1',
        type: 'open',
        scheduledAt: futureTime
      }))

      jest.spyOn(warmupExecutor, 'simulateInteraction').mockResolvedValue()

      await warmupExecutor.processInteractionSimulations()

      expect(warmupExecutor.simulateInteraction).not.toHaveBeenCalled()
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('simulateInteraction', () => {
    const mockEmail = {
      id: 'email-1',
      warmup_job_id: 'job-1',
      recipient_email: 'test@example.com'
    }

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockEmail, error: null }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        })),
        insert: jest.fn(() => ({ error: null }))
      })
    })

    it('should simulate email open', async () => {
      await warmupExecutor.simulateInteraction('email-1', 'open')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_emails')
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_jobs')
    })

    it('should simulate email reply', async () => {
      await warmupExecutor.simulateInteraction('email-1', 'reply')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_emails')
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_jobs')
    })

    it('should simulate email click', async () => {
      await warmupExecutor.simulateInteraction('email-1', 'click')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_email_clicks')
    })

    it('should handle missing email', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      })

      // Should not throw
      await expect(warmupExecutor.simulateInteraction('email-1', 'open'))
        .resolves.not.toThrow()
    })
  })

  describe('monitorWarmupHealth', () => {
    it('should handle stuck jobs', async () => {
      const stuckJob = {
        ...mockWarmupJob,
        status: 'running',
        started_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        warmup_plans: mockWarmupPlan
      }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({ data: [stuckJob], error: null }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor, 'handleStuckJob').mockResolvedValue()
      jest.spyOn(warmupExecutor as any, 'checkWarmupPerformance').mockResolvedValue()

      await warmupExecutor.monitorWarmupHealth()

      expect(warmupExecutor.handleStuckJob).toHaveBeenCalledWith(stuckJob)
    })

    it('should check warmup performance', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({ data: [], error: null }))
          }))
        }))
      })

      jest.spyOn(warmupExecutor as any, 'checkWarmupPerformance').mockResolvedValue()

      await warmupExecutor.monitorWarmupHealth()

      expect(warmupExecutor as any).checkWarmupPerformance.toHaveBeenCalled()
    })
  })

  describe('getExecutionStats', () => {
    it('should return comprehensive execution statistics', async () => {
      const mockJobs = [
        {
          ...mockWarmupJob,
          status: 'completed',
          emails_sent: 10,
          emails_delivered: 9,
          emails_opened: 3,
          emails_replied: 1,
          scheduled_date: '2024-01-15'
        },
        {
          ...mockWarmupJob,
          id: 'job-2',
          status: 'failed',
          emails_sent: 5,
          emails_delivered: 3,
          emails_opened: 1,
          emails_replied: 0,
          scheduled_date: '2024-01-14'
        }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() => ({ data: mockJobs, error: null }))
            }))
          }))
        }))
      })

      const stats = await warmupExecutor.getExecutionStats('plan-1', 7)

      expect(stats.totalJobs).toBe(2)
      expect(stats.completedJobs).toBe(1)
      expect(stats.failedJobs).toBe(1)
      expect(stats.totalEmailsSent).toBe(15)
      expect(stats.totalEmailsDelivered).toBe(12)
      expect(stats.averageDeliveryRate).toBe(0.8) // 12/15
      expect(stats.recentJobs).toHaveLength(2)
    })

    it('should handle no jobs', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() => ({ data: [], error: null }))
            }))
          }))
        }))
      })

      const stats = await warmupExecutor.getExecutionStats('plan-1', 7)

      expect(stats.totalJobs).toBe(0)
      expect(stats.totalEmailsSent).toBe(0)
      expect(stats.averageDeliveryRate).toBe(0)
      expect(stats.recentJobs).toHaveLength(0)
    })
  })
})

describe('Integration Tests', () => {
  let warmupExecutor: WarmupExecutor

  beforeEach(() => {
    warmupExecutor = new WarmupExecutor(
      mockSupabase,
      mockRedis,
      mockWarmupSystem as any,
      mockRateLimiter as any,
      mockTimezoneScheduler as any,
      mockEmailService
    )
  })

  it('should handle complete warmup execution workflow', async () => {
    // Schedule daily jobs
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ data: [mockWarmupPlan], error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
          }))
        }))
      }))
    })

    jest.spyOn(warmupExecutor, 'createWarmupJob').mockResolvedValue(mockWarmupJob)

    await warmupExecutor.scheduleDailyWarmupJobs()

    // Execute jobs
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ data: [mockWarmupJob], error: null }))
        }))
      }))
    })

    jest.spyOn(warmupExecutor, 'executeWarmupJob').mockResolvedValue()

    await warmupExecutor.executeWarmupJobs()

    // Process simulations
    mockRedis.keys.mockResolvedValueOnce([])

    await warmupExecutor.processInteractionSimulations()

    // Monitor health
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          in: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    })

    jest.spyOn(warmupExecutor as any, 'checkWarmupPerformance').mockResolvedValue()

    await warmupExecutor.monitorWarmupHealth()

    expect(warmupExecutor.createWarmupJob).toHaveBeenCalled()
    expect(warmupExecutor.executeWarmupJob).toHaveBeenCalled()
  })

  it('should handle failures and recovery', async () => {
    // Test job failure
    const failedJob = { ...mockWarmupJob, status: 'running', started_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() }

    jest.spyOn(warmupExecutor as any, 'failWarmupJob').mockResolvedValue()
    jest.spyOn(warmupExecutor as any, 'getRecentJobFailures').mockResolvedValue(3)

    await warmupExecutor.handleStuckJob({ ...failedJob, warmup_plans: mockWarmupPlan })

    expect(warmupExecutor as any).failWarmupJob.toHaveBeenCalled()
    expect(mockWarmupSystem.pauseWarmup).toHaveBeenCalled()
  })
})