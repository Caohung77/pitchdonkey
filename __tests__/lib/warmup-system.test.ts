import { WarmupSystem, WarmupUtils, WarmupPlan, WarmupMetrics } from '../../lib/warmup-system'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } })),
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ error: null }))
    }))
  }))
}

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}

// Mock notification service
const mockNotificationService = {
  send: jest.fn()
}

const mockWarmupPlan: WarmupPlan = {
  id: 'warmup-1',
  user_id: 'user-1',
  email_account_id: 'account-1',
  strategy: 'moderate',
  status: 'active',
  current_week: 1,
  total_weeks: 3,
  daily_target: 8,
  actual_sent_today: 5,
  total_sent: 25,
  start_date: '2024-01-01T00:00:00Z',
  expected_completion_date: '2024-01-22T00:00:00Z',
  settings: {
    max_daily_increase: 5,
    min_daily_volume: 8,
    max_daily_volume: 50,
    target_open_rate: 0.20,
    target_reply_rate: 0.03,
    max_bounce_rate: 0.05,
    max_spam_rate: 0.003,
    weekend_sending: true,
    business_hours_only: true,
    domain_diversification: true,
    content_variation: true,
    reply_simulation: true,
    auto_pause_on_issues: true
  },
  metrics: {
    emails_sent: 25,
    emails_delivered: 24,
    emails_opened: 5,
    emails_replied: 1,
    emails_bounced: 1,
    spam_complaints: 0,
    unsubscribes: 0,
    delivery_rate: 0.96,
    open_rate: 0.21,
    reply_rate: 0.04,
    bounce_rate: 0.04,
    spam_rate: 0,
    reputation_score: 75,
    health_score: 85,
    trend: 'improving'
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

describe('WarmupSystem', () => {
  let warmupSystem: WarmupSystem

  beforeEach(() => {
    warmupSystem = new WarmupSystem(mockSupabase, mockRedis, mockNotificationService)
    jest.clearAllMocks()
  })

  describe('createWarmupPlan', () => {
    it('should create a conservative warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ 
              data: { ...mockWarmupPlan, strategy: 'conservative', total_weeks: 4 }, 
              error: null 
            }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const plan = await warmupSystem.createWarmupPlan('user-1', 'account-1', 'conservative')

      expect(plan.strategy).toBe('conservative')
      expect(plan.total_weeks).toBe(4)
      expect(plan.status).toBe('pending')
      expect(plan.settings.max_daily_volume).toBe(30)
    })

    it('should create a moderate warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const plan = await warmupSystem.createWarmupPlan('user-1', 'account-1', 'moderate')

      expect(plan.strategy).toBe('moderate')
      expect(plan.total_weeks).toBe(3)
      expect(plan.settings.max_daily_volume).toBe(50)
    })

    it('should create an aggressive warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ 
              data: { ...mockWarmupPlan, strategy: 'aggressive', total_weeks: 2 }, 
              error: null 
            }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const plan = await warmupSystem.createWarmupPlan('user-1', 'account-1', 'aggressive')

      expect(plan.strategy).toBe('aggressive')
      expect(plan.total_weeks).toBe(2)
      expect(plan.settings.max_daily_volume).toBe(80)
    })

    it('should apply custom settings', async () => {
      const customSettings = {
        max_daily_volume: 75,
        target_open_rate: 0.25,
        weekend_sending: false
      }

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ 
              data: { ...mockWarmupPlan, settings: { ...mockWarmupPlan.settings, ...customSettings } }, 
              error: null 
            }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const plan = await warmupSystem.createWarmupPlan('user-1', 'account-1', 'moderate', customSettings)

      expect(plan.settings.max_daily_volume).toBe(75)
      expect(plan.settings.target_open_rate).toBe(0.25)
      expect(plan.settings.weekend_sending).toBe(false)
    })

    it('should send notification after creation', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      await warmupSystem.createWarmupPlan('user-1', 'account-1', 'moderate')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_notifications')
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      })

      await expect(warmupSystem.createWarmupPlan('user-1', 'account-1', 'moderate'))
        .rejects.toThrow('Database error')
    })
  })

  describe('startWarmup', () => {
    it('should start a pending warmup plan', async () => {
      const pendingPlan = { ...mockWarmupPlan, status: 'pending' }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: pendingPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      await warmupSystem.startWarmup('warmup-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
      expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
    })

    it('should not start non-pending warmup plan', async () => {
      const activePlan = { ...mockWarmupPlan, status: 'active' }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: activePlan, error: null }))
          }))
        }))
      })

      await expect(warmupSystem.startWarmup('warmup-1'))
        .rejects.toThrow('Cannot start warmup in status: active')
    })

    it('should handle missing warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      })

      await expect(warmupSystem.startWarmup('warmup-1'))
        .rejects.toThrow('Warmup plan not found')
    })
  })

  describe('getWarmupProgress', () => {
    it('should return complete progress information', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
            }))
          }))
        }))
      })

      // Mock today's activity
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: {
                  emails_sent: 5,
                  emails_delivered: 5,
                  emails_opened: 1,
                  emails_replied: 0,
                  emails_bounced: 0,
                  spam_complaints: 0
                }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const progress = await warmupSystem.getWarmupProgress('account-1')

      expect(progress.plan).toBeDefined()
      expect(progress.schedule).toBeDefined()
      expect(progress.currentWeekProgress).toHaveProperty('week')
      expect(progress.currentWeekProgress).toHaveProperty('target')
      expect(progress.currentWeekProgress).toHaveProperty('sent')
      expect(progress.overallProgress).toHaveProperty('percentage')
      expect(progress.recommendations).toBeDefined()
    })

    it('should handle no active warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        }))
      })

      await expect(warmupSystem.getWarmupProgress('account-1'))
        .rejects.toThrow('No active warmup plan found')
    })

    it('should calculate progress percentages correctly', async () => {
      const planInProgress = {
        ...mockWarmupPlan,
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        current_week: 2,
        total_sent: 50
      }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: planInProgress, error: null }))
            }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: { emails_sent: 8 }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const progress = await warmupSystem.getWarmupProgress('account-1')

      expect(progress.currentWeekProgress.percentage).toBeGreaterThan(0)
      expect(progress.overallProgress.percentage).toBeGreaterThan(0)
      expect(progress.overallProgress.days_elapsed).toBe(7)
    })
  })

  describe('updateWarmupMetrics', () => {
    it('should update metrics and record activity', async () => {
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

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const activity = {
        emails_sent: 5,
        emails_delivered: 5,
        emails_opened: 1,
        emails_replied: 0,
        emails_bounced: 0,
        spam_complaints: 0,
        content_type: 'introduction',
        recipient_type: 'internal'
      }

      await warmupSystem.updateWarmupMetrics('warmup-1', activity)

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_activities')
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
    })

    it('should auto-pause on critical issues', async () => {
      const planWithIssues = {
        ...mockWarmupPlan,
        settings: {
          ...mockWarmupPlan.settings,
          auto_pause_on_issues: true,
          max_bounce_rate: 0.05,
          max_spam_rate: 0.003
        }
      }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: planWithIssues, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      // Mock pause operation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: planWithIssues, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      const criticalActivity = {
        emails_sent: 10,
        emails_delivered: 5,
        emails_opened: 0,
        emails_replied: 0,
        emails_bounced: 5, // 50% bounce rate - critical
        spam_complaints: 0,
        content_type: 'introduction',
        recipient_type: 'internal'
      }

      await warmupSystem.updateWarmupMetrics('warmup-1', criticalActivity)

      // Should have called pause functionality
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
    })

    it('should handle missing warmup plan', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      })

      const activity = {
        emails_sent: 5,
        emails_delivered: 5,
        emails_opened: 1,
        emails_replied: 0,
        emails_bounced: 0,
        spam_complaints: 0,
        content_type: 'introduction',
        recipient_type: 'internal'
      }

      await expect(warmupSystem.updateWarmupMetrics('warmup-1', activity))
        .rejects.toThrow('Warmup plan not found')
    })
  })

  describe('pauseWarmup', () => {
    it('should pause active warmup', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      await warmupSystem.pauseWarmup('warmup-1', 'High bounce rate detected')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_notifications')
    })
  })

  describe('resumeWarmup', () => {
    it('should resume paused warmup', async () => {
      const pausedPlan = { ...mockWarmupPlan, status: 'paused' }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: pausedPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      await warmupSystem.resumeWarmup('warmup-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
    })

    it('should not resume non-paused warmup', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      await expect(warmupSystem.resumeWarmup('warmup-1'))
        .rejects.toThrow('Cannot resume warmup in status: active')
    })
  })

  describe('completeWarmup', () => {
    it('should complete warmup and update account status', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockWarmupPlan, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({ error: null }))
      })

      await warmupSystem.completeWarmup('warmup-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
      expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
      expect(mockSupabase.from).toHaveBeenCalledWith('warmup_notifications')
    })
  })

  describe('getWarmupStats', () => {
    it('should return comprehensive warmup statistics', async () => {
      const mockPlans = [
        { ...mockWarmupPlan, status: 'active' },
        { ...mockWarmupPlan, id: 'warmup-2', status: 'completed' },
        { ...mockWarmupPlan, id: 'warmup-3', status: 'paused' }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: mockPlans, error: null }))
        }))
      })

      const stats = await warmupSystem.getWarmupStats('user-1')

      expect(stats.total_accounts).toBe(3)
      expect(stats.warming_up).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.paused).toBe(1)
      expect(stats.failed).toBe(0)
      expect(stats.accounts).toHaveLength(3)
    })

    it('should calculate success rate correctly', async () => {
      const mockPlans = [
        { ...mockWarmupPlan, status: 'completed' },
        { ...mockWarmupPlan, id: 'warmup-2', status: 'completed' },
        { ...mockWarmupPlan, id: 'warmup-3', status: 'failed' }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: mockPlans, error: null }))
        }))
      })

      const stats = await warmupSystem.getWarmupStats('user-1')

      expect(stats.success_rate).toBe(66.66666666666666) // 2/3 * 100
    })

    it('should handle empty results', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: [], error: null }))
        }))
      })

      const stats = await warmupSystem.getWarmupStats('user-1')

      expect(stats.total_accounts).toBe(0)
      expect(stats.accounts).toHaveLength(0)
    })
  })
})

describe('WarmupUtils', () => {
  describe('getRecommendedStrategy', () => {
    it('should recommend conservative for new domains', () => {
      const strategy = WarmupUtils.getRecommendedStrategy(30, 15, true, 'medium')
      expect(strategy).toBe('conservative')
    })

    it('should recommend conservative for accounts without authentication', () => {
      const strategy = WarmupUtils.getRecommendedStrategy(60, 200, false, 'medium')
      expect(strategy).toBe('conservative')
    })

    it('should recommend aggressive for urgent needs with established domains', () => {
      const strategy = WarmupUtils.getRecommendedStrategy(30, 200, true, 'high')
      expect(strategy).toBe('aggressive')
    })

    it('should recommend moderate for typical scenarios', () => {
      const strategy = WarmupUtils.getRecommendedStrategy(30, 100, true, 'medium')
      expect(strategy).toBe('moderate')
    })
  })

  describe('calculateEstimatedCompletion', () => {
    it('should calculate completion time for conservative strategy', () => {
      const completion = WarmupUtils.calculateEstimatedCompletion('conservative', 50)
      
      expect(completion.days).toBe(14) // 50% of 28 days remaining
      expect(completion.weeks).toBe(2)
    })

    it('should calculate completion time for moderate strategy', () => {
      const completion = WarmupUtils.calculateEstimatedCompletion('moderate', 33.33)
      
      expect(completion.days).toBe(14) // ~66.67% of 21 days remaining
      expect(completion.weeks).toBe(2)
    })

    it('should calculate completion time for aggressive strategy', () => {
      const completion = WarmupUtils.calculateEstimatedCompletion('aggressive', 75)
      
      expect(completion.days).toBe(4) // 25% of 14 days remaining
      expect(completion.weeks).toBe(1)
    })

    it('should handle 100% completion', () => {
      const completion = WarmupUtils.calculateEstimatedCompletion('moderate', 100)
      
      expect(completion.days).toBe(0)
      expect(completion.weeks).toBe(0)
    })
  })

  describe('validateWarmupSettings', () => {
    it('should validate correct settings', () => {
      const validSettings = {
        max_daily_increase: 5,
        min_daily_volume: 10,
        max_daily_volume: 50,
        target_open_rate: 0.25,
        target_reply_rate: 0.05,
        max_bounce_rate: 0.03,
        max_spam_rate: 0.002,
        weekend_sending: true,
        business_hours_only: true,
        domain_diversification: true,
        content_variation: true,
        reply_simulation: true,
        auto_pause_on_issues: true
      }

      const result = WarmupUtils.validateWarmupSettings(validSettings)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid daily increase', () => {
      const invalidSettings = {
        max_daily_increase: 25, // Too high
        min_daily_volume: 10,
        max_daily_volume: 50
      }

      const result = WarmupUtils.validateWarmupSettings(invalidSettings)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject invalid rates', () => {
      const invalidSettings = {
        max_daily_increase: 5,
        min_daily_volume: 10,
        max_daily_volume: 50,
        target_open_rate: 1.5, // Invalid rate > 1
        max_bounce_rate: -0.01 // Invalid negative rate
      }

      const result = WarmupUtils.validateWarmupSettings(invalidSettings)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle partial settings validation', () => {
      const partialSettings = {
        max_daily_increase: 5,
        target_open_rate: 0.25
      }

      const result = WarmupUtils.validateWarmupSettings(partialSettings)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})

describe('Integration Tests', () => {
  let warmupSystem: WarmupSystem

  beforeEach(() => {
    warmupSystem = new WarmupSystem(mockSupabase, mockRedis, mockNotificationService)
  })

  it('should handle complete warmup lifecycle', async () => {
    // Create warmup plan
    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: { ...mockWarmupPlan, status: 'pending' }, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    const plan = await warmupSystem.createWarmupPlan('user-1', 'account-1', 'moderate')
    expect(plan.status).toBe('pending')

    // Start warmup
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { ...plan, status: 'pending' }, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    await warmupSystem.startWarmup(plan.id)

    // Update metrics
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { ...plan, status: 'active' }, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    const activity = {
      emails_sent: 8,
      emails_delivered: 8,
      emails_opened: 2,
      emails_replied: 1,
      emails_bounced: 0,
      spam_complaints: 0,
      content_type: 'introduction',
      recipient_type: 'internal'
    }

    await warmupSystem.updateWarmupMetrics(plan.id, activity)

    // Complete warmup
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { ...plan, status: 'active' }, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    await warmupSystem.completeWarmup(plan.id)

    // Verify all database calls were made
    expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
    expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
    expect(mockSupabase.from).toHaveBeenCalledWith('warmup_activities')
    expect(mockSupabase.from).toHaveBeenCalledWith('warmup_notifications')
  })

  it('should handle warmup failure and recovery', async () => {
    const failingPlan = {
      ...mockWarmupPlan,
      metrics: {
        ...mockWarmupPlan.metrics,
        bounce_rate: 0.15, // High bounce rate
        health_score: 25 // Low health score
      }
    }

    // Pause due to issues
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: failingPlan, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    await warmupSystem.pauseWarmup('warmup-1', 'High bounce rate detected')

    // Resume after fixing issues
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { ...failingPlan, status: 'paused' }, error: null }))
        }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({ error: null }))
    })

    await warmupSystem.resumeWarmup('warmup-1')

    expect(mockSupabase.from).toHaveBeenCalledWith('warmup_plans')
    expect(mockSupabase.from).toHaveBeenCalledWith('warmup_notifications')
  })
})