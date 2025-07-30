import { RateLimiter, RateLimitUtils, RateLimitConfig, SendingQuota, DistributionStrategy } from '../../lib/rate-limiter'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } })),
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
        }))
      })),
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({ data: [], error: null })),
        not: jest.fn(() => ({ data: [], error: null }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({ data: mockRateLimitConfig, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockRateLimitConfig, error: null }))
        }))
      }))
    })),
    upsert: jest.fn(() => ({ error: null }))
  }))
}

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}

const mockRateLimitConfig: RateLimitConfig = {
  id: 'config-1',
  user_id: 'user-1',
  email_account_id: 'account-1',
  daily_limit: 50,
  hourly_limit: 10,
  domain_daily_limit: 5,
  warmup_mode: false,
  burst_limit: 5,
  cooldown_period_minutes: 10,
  retry_config: {
    max_attempts: 3,
    backoff_strategy: 'exponential',
    base_delay_ms: 5000,
    max_delay_ms: 300000,
    retryable_errors: ['RATE_LIMIT_EXCEEDED', 'TEMPORARY_FAILURE'],
    jitter: true
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter(mockSupabase, mockRedis)
    rateLimiter.clearCaches()
    jest.clearAllMocks()
  })

  describe('checkSendingQuota', () => {
    it('should return available quota for new account', async () => {
      // Mock config retrieval
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockRateLimitConfig, error: null }))
          }))
        }))
      })

      // Mock usage retrieval
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: {
                  email_account_id: 'account-1',
                  date: '2024-01-15',
                  hour: 10,
                  emails_sent: 5,
                  domains_targeted: { 'example.com': 2 },
                  last_send_at: '2024-01-15T10:00:00Z',
                  burst_count: 1,
                  burst_window_start: '2024-01-15T10:00:00Z'
                }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const quota = await rateLimiter.checkSendingQuota('account-1', 'example.com')

      expect(quota.account_id).toBe('account-1')
      expect(quota.daily_remaining).toBe(45) // 50 - 5
      expect(quota.domain_limits['example.com']).toBe(3) // 5 - 2
      expect(quota.is_available).toBe(true)
    })

    it('should return unavailable quota when daily limit exceeded', async () => {
      const configWithLowLimit = {
        ...mockRateLimitConfig,
        daily_limit: 10
      }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: configWithLowLimit, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: {
                  email_account_id: 'account-1',
                  date: '2024-01-15',
                  hour: 10,
                  emails_sent: 10, // At limit
                  domains_targeted: { 'example.com': 2 },
                  last_send_at: '2024-01-15T10:00:00Z',
                  burst_count: 1,
                  burst_window_start: '2024-01-15T10:00:00Z'
                }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const quota = await rateLimiter.checkSendingQuota('account-1', 'example.com')

      expect(quota.daily_remaining).toBe(0)
      expect(quota.is_available).toBe(false)
      expect(quota.next_available_slot).toBeDefined()
    })

    it('should return unavailable quota when domain limit exceeded', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: mockRateLimitConfig, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: {
                  email_account_id: 'account-1',
                  date: '2024-01-15',
                  hour: 10,
                  emails_sent: 10,
                  domains_targeted: { 'example.com': 5 }, // At domain limit
                  last_send_at: '2024-01-15T10:00:00Z',
                  burst_count: 1,
                  burst_window_start: '2024-01-15T10:00:00Z'
                }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const quota = await rateLimiter.checkSendingQuota('account-1', 'example.com')

      expect(quota.domain_limits['example.com']).toBe(0)
      expect(quota.is_available).toBe(false)
    })

    it('should handle warmup mode limits', async () => {
      const warmupConfig = {
        ...mockRateLimitConfig,
        warmup_mode: true,
        warmup_daily_limit: 20
      }

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: warmupConfig, error: null }))
          }))
        }))
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: {
                  email_account_id: 'account-1',
                  date: '2024-01-15',
                  hour: 10,
                  emails_sent: 15,
                  domains_targeted: { 'example.com': 2 },
                  last_send_at: '2024-01-15T10:00:00Z',
                  burst_count: 1,
                  burst_window_start: '2024-01-15T10:00:00Z'
                }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const quota = await rateLimiter.checkSendingQuota('account-1', 'example.com')

      expect(quota.daily_remaining).toBe(5) // 20 (warmup limit) - 15
      expect(quota.warmup_limit).toBe(20)
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      })

      const quota = await rateLimiter.checkSendingQuota('account-1', 'example.com')

      expect(quota.is_available).toBe(false)
      expect(quota.daily_remaining).toBe(0)
    })
  })

  describe('selectEmailAccount', () => {
    const mockAccounts = [
      { id: 'account-1', email: 'test1@example.com', warmup_status: 'completed' },
      { id: 'account-2', email: 'test2@example.com', warmup_status: 'completed' },
      { id: 'account-3', email: 'test3@example.com', warmup_status: 'in_progress' }
    ]

    beforeEach(() => {
      // Mock getting available accounts
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockAccounts, error: null }))
          }))
        }))
      })
    })

    it('should select account using least_used strategy', async () => {
      const strategy: DistributionStrategy = { type: 'least_used' }

      // Mock quota checks for each account
      jest.spyOn(rateLimiter, 'checkSendingQuota')
        .mockResolvedValueOnce({
          account_id: 'account-1',
          daily_remaining: 30,
          hourly_remaining: 8,
          domain_limits: { 'example.com': 3 },
          next_available_slot: new Date().toISOString(),
          is_available: true,
          burst_available: 5
        })
        .mockResolvedValueOnce({
          account_id: 'account-2',
          daily_remaining: 45, // Most remaining
          hourly_remaining: 10,
          domain_limits: { 'example.com': 5 },
          next_available_slot: new Date().toISOString(),
          is_available: true,
          burst_available: 5
        })
        .mockResolvedValueOnce({
          account_id: 'account-3',
          daily_remaining: 20,
          hourly_remaining: 5,
          domain_limits: { 'example.com': 2 },
          next_available_slot: new Date().toISOString(),
          is_available: true,
          burst_available: 3
        })

      const result = await rateLimiter.selectEmailAccount('user-1', 'example.com', strategy)

      expect(result).not.toBeNull()
      expect(result?.accountId).toBe('account-2') // Account with most remaining quota
    })

    it('should return scheduled time when no accounts available immediately', async () => {
      const strategy: DistributionStrategy = { type: 'least_used' }

      // Mock all accounts as unavailable
      jest.spyOn(rateLimiter, 'checkSendingQuota')
        .mockResolvedValue({
          account_id: 'account-1',
          daily_remaining: 0,
          hourly_remaining: 0,
          domain_limits: { 'example.com': 0 },
          next_available_slot: '2024-01-15T15:00:00Z',
          is_available: false,
          burst_available: 0
        })

      const result = await rateLimiter.selectEmailAccount('user-1', 'example.com', strategy)

      expect(result).not.toBeNull()
      expect(result?.scheduledFor).toBeDefined()
    })

    it('should exclude specified accounts', async () => {
      const strategy: DistributionStrategy = { 
        type: 'least_used',
        exclude_accounts: ['account-1', 'account-2']
      }

      // Mock getting available accounts with exclusion
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({ data: [mockAccounts[2]], error: null }))
            }))
          }))
        }))
      })

      jest.spyOn(rateLimiter, 'checkSendingQuota')
        .mockResolvedValueOnce({
          account_id: 'account-3',
          daily_remaining: 20,
          hourly_remaining: 5,
          domain_limits: { 'example.com': 2 },
          next_available_slot: new Date().toISOString(),
          is_available: true,
          burst_available: 3
        })

      const result = await rateLimiter.selectEmailAccount('user-1', 'example.com', strategy)

      expect(result?.accountId).toBe('account-3')
    })

    it('should return null when no accounts available', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }))
      })

      const result = await rateLimiter.selectEmailAccount('user-1', 'example.com')

      expect(result).toBeNull()
    })
  })

  describe('recordSend', () => {
    it('should record successful send', async () => {
      const updateSpy = jest.spyOn(mockSupabase, 'from').mockReturnValue({
        upsert: jest.fn(() => ({ error: null }))
      })

      await rateLimiter.recordSend('account-1', 'example.com', true)

      expect(updateSpy).toHaveBeenCalledWith('rate_limit_usage')
    })

    it('should record failed send with error', async () => {
      const updateSpy = jest.spyOn(mockSupabase, 'from').mockReturnValue({
        upsert: jest.fn(() => ({ error: null }))
      })

      await rateLimiter.recordSend('account-1', 'example.com', false, 'SMTP_ERROR')

      expect(updateSpy).toHaveBeenCalledWith('rate_limit_usage')
    })

    it('should handle database errors gracefully', async () => {
      jest.spyOn(mockSupabase, 'from').mockReturnValue({
        upsert: jest.fn(() => ({ error: new Error('Database error') }))
      })

      // Should not throw
      await expect(rateLimiter.recordSend('account-1', 'example.com', true))
        .resolves.not.toThrow()
    })
  })

  describe('scheduleRetry', () => {
    const mockSendRequest = {
      id: 'request-1',
      user_id: 'user-1',
      campaign_id: 'campaign-1',
      contact_id: 'contact-1',
      recipient_email: 'test@example.com',
      recipient_domain: 'example.com',
      priority: 'normal' as const,
      scheduled_at: '2024-01-15T10:00:00Z',
      retry_count: 0,
      max_retries: 3,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    }

    it('should schedule retry for retryable error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const result = await rateLimiter.scheduleRetry(mockSendRequest, 'RATE_LIMIT_EXCEEDED')

      expect(result.shouldRetry).toBe(true)
      expect(result.retryAt).toBeDefined()
      expect(result.finalFailure).toBeUndefined()
    })

    it('should not retry non-retryable error', async () => {
      const result = await rateLimiter.scheduleRetry(mockSendRequest, 'INVALID_EMAIL')

      expect(result.shouldRetry).toBe(false)
      expect(result.finalFailure).toBe(true)
      expect(result.retryAt).toBeUndefined()
    })

    it('should not retry when max attempts exceeded', async () => {
      const exhaustedRequest = {
        ...mockSendRequest,
        retry_count: 3
      }

      const result = await rateLimiter.scheduleRetry(exhaustedRequest, 'RATE_LIMIT_EXCEEDED')

      expect(result.shouldRetry).toBe(false)
      expect(result.finalFailure).toBe(true)
    })

    it('should calculate exponential backoff delay', async () => {
      const request1 = { ...mockSendRequest, retry_count: 0 }
      const request2 = { ...mockSendRequest, retry_count: 1 }

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null }))
        }))
      })

      const result1 = await rateLimiter.scheduleRetry(request1, 'RATE_LIMIT_EXCEEDED')
      const result2 = await rateLimiter.scheduleRetry(request2, 'RATE_LIMIT_EXCEEDED')

      expect(result1.shouldRetry).toBe(true)
      expect(result2.shouldRetry).toBe(true)

      // Second retry should be scheduled later than first
      const delay1 = new Date(result1.retryAt!).getTime() - Date.now()
      const delay2 = new Date(result2.retryAt!).getTime() - Date.now()
      expect(delay2).toBeGreaterThan(delay1)
    })
  })

  describe('getRateLimitStats', () => {
    it('should return stats for user accounts', async () => {
      // Mock getting user accounts
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockAccounts, error: null }))
          }))
        }))
      })

      // Mock getting configs and usage stats
      jest.spyOn(rateLimiter as any, 'getRateLimitConfig')
        .mockResolvedValue(mockRateLimitConfig)

      jest.spyOn(rateLimiter as any, 'getUsageStats')
        .mockResolvedValue({
          emails_sent: 25,
          domains_targeted: 5,
          success_rate: 0.95
        })

      const stats = await rateLimiter.getRateLimitStats('user-1')

      expect(stats.accounts).toHaveLength(3)
      expect(stats.accounts[0]).toHaveProperty('usage_percentage')
      expect(stats.accounts[0]).toHaveProperty('emails_sent')
      expect(stats.total_usage).toHaveProperty('emails_sent')
      expect(stats.total_usage).toHaveProperty('success_rate')
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      })

      await expect(rateLimiter.getRateLimitStats('user-1'))
        .rejects.toThrow('Database error')
    })
  })

  describe('updateRateLimitConfig', () => {
    it('should update configuration successfully', async () => {
      const updates = {
        daily_limit: 75,
        hourly_limit: 15
      }

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: { ...mockRateLimitConfig, ...updates }, 
                error: null 
              }))
            }))
          }))
        }))
      })

      const result = await rateLimiter.updateRateLimitConfig('account-1', updates)

      expect(result.daily_limit).toBe(75)
      expect(result.hourly_limit).toBe(15)
    })

    it('should validate updates before applying', async () => {
      const invalidUpdates = {
        daily_limit: -10, // Invalid negative value
        hourly_limit: 15
      }

      await expect(rateLimiter.updateRateLimitConfig('account-1', invalidUpdates))
        .rejects.toThrow()
    })

    it('should clear caches after update', async () => {
      const clearSpy = jest.spyOn(rateLimiter as any, 'clearAccountCaches')

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({ 
                data: mockRateLimitConfig, 
                error: null 
              }))
            }))
          }))
        }))
      })

      await rateLimiter.updateRateLimitConfig('account-1', { daily_limit: 75 })

      expect(clearSpy).toHaveBeenCalledWith('account-1')
    })
  })
})

describe('RateLimitUtils', () => {
  describe('calculateRampUpRate', () => {
    it('should return conservative rate for new accounts', () => {
      const rate = RateLimitUtils.calculateRampUpRate(3, 10, 50, 'conservative')
      
      expect(rate).toBeLessThanOrEqual(20) // Max for first week
      expect(rate).toBeGreaterThan(10) // Should increase from current
    })

    it('should return moderate rate for week-old accounts', () => {
      const rate = RateLimitUtils.calculateRampUpRate(10, 25, 50, 'moderate')
      
      expect(rate).toBeLessThanOrEqual(35) // Max for second week
      expect(rate).toBeGreaterThan(25) // Should increase from current
    })

    it('should return target rate for mature accounts', () => {
      const rate = RateLimitUtils.calculateRampUpRate(35, 40, 50, 'moderate')
      
      expect(rate).toBe(50) // Should reach target
    })

    it('should handle different strategies', () => {
      const conservative = RateLimitUtils.calculateRampUpRate(20, 30, 50, 'conservative')
      const aggressive = RateLimitUtils.calculateRampUpRate(20, 30, 50, 'aggressive')
      
      expect(aggressive).toBeGreaterThanOrEqual(conservative)
    })
  })

  describe('isHighRiskDomain', () => {
    it('should identify high-risk domains', () => {
      expect(RateLimitUtils.isHighRiskDomain('gmail.com')).toBe(true)
      expect(RateLimitUtils.isHighRiskDomain('yahoo.com')).toBe(true)
      expect(RateLimitUtils.isHighRiskDomain('outlook.com')).toBe(true)
    })

    it('should not flag low-risk domains', () => {
      expect(RateLimitUtils.isHighRiskDomain('company.com')).toBe(false)
      expect(RateLimitUtils.isHighRiskDomain('business.org')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(RateLimitUtils.isHighRiskDomain('GMAIL.COM')).toBe(true)
      expect(RateLimitUtils.isHighRiskDomain('Gmail.Com')).toBe(true)
    })
  })

  describe('getRecommendedLimits', () => {
    it('should return conservative limits for new accounts', () => {
      const limits = RateLimitUtils.getRecommendedLimits(5, 'pending')
      
      expect(limits.dailyLimit).toBeLessThanOrEqual(25)
      expect(limits.hourlyLimit).toBeLessThanOrEqual(5)
      expect(limits.domainLimit).toBeLessThanOrEqual(3)
    })

    it('should return higher limits for mature accounts', () => {
      const limits = RateLimitUtils.getRecommendedLimits(35, 'completed')
      
      expect(limits.dailyLimit).toBeGreaterThan(25)
      expect(limits.hourlyLimit).toBeGreaterThan(5)
      expect(limits.domainLimit).toBeGreaterThan(3)
    })

    it('should adjust limits based on performance', () => {
      const goodPerformance = {
        deliveryRate: 0.98,
        bounceRate: 0.01,
        spamComplaints: 0.0005
      }

      const poorPerformance = {
        deliveryRate: 0.80,
        bounceRate: 0.08,
        spamComplaints: 0.01
      }

      const goodLimits = RateLimitUtils.getRecommendedLimits(35, 'completed', goodPerformance)
      const poorLimits = RateLimitUtils.getRecommendedLimits(35, 'completed', poorPerformance)

      expect(goodLimits.dailyLimit).toBeGreaterThan(poorLimits.dailyLimit)
      expect(goodLimits.hourlyLimit).toBeGreaterThan(poorLimits.hourlyLimit)
    })

    it('should handle missing performance data', () => {
      const limits = RateLimitUtils.getRecommendedLimits(35, 'completed')
      
      expect(limits.dailyLimit).toBeGreaterThan(0)
      expect(limits.hourlyLimit).toBeGreaterThan(0)
      expect(limits.domainLimit).toBeGreaterThan(0)
    })
  })
})

describe('Integration Tests', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter(mockSupabase, mockRedis)
  })

  it('should handle complete send workflow', async () => {
    // Mock account selection
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ data: [mockAccounts[0]], error: null }))
        }))
      }))
    })

    jest.spyOn(rateLimiter, 'checkSendingQuota')
      .mockResolvedValue({
        account_id: 'account-1',
        daily_remaining: 30,
        hourly_remaining: 8,
        domain_limits: { 'example.com': 3 },
        next_available_slot: new Date().toISOString(),
        is_available: true,
        burst_available: 5
      })

    // Select account
    const selection = await rateLimiter.selectEmailAccount('user-1', 'example.com')
    expect(selection?.accountId).toBe('account-1')

    // Record send
    mockSupabase.from.mockReturnValue({
      upsert: jest.fn(() => ({ error: null }))
    })

    await rateLimiter.recordSend('account-1', 'example.com', true)

    // Verify quota is updated (would be checked in next call)
    const updatedQuota = await rateLimiter.checkSendingQuota('account-1', 'example.com')
    expect(updatedQuota.account_id).toBe('account-1')
  })

  it('should handle retry workflow for failed sends', async () => {
    const sendRequest = {
      id: 'request-1',
      user_id: 'user-1',
      campaign_id: 'campaign-1',
      contact_id: 'contact-1',
      recipient_email: 'test@example.com',
      recipient_domain: 'example.com',
      priority: 'normal' as const,
      scheduled_at: '2024-01-15T10:00:00Z',
      retry_count: 0,
      max_retries: 3,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    }

    mockSupabase.from.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      }))
    })

    // First retry
    const retry1 = await rateLimiter.scheduleRetry(sendRequest, 'RATE_LIMIT_EXCEEDED')
    expect(retry1.shouldRetry).toBe(true)

    // Second retry
    const retry2 = await rateLimiter.scheduleRetry(
      { ...sendRequest, retry_count: 1 }, 
      'RATE_LIMIT_EXCEEDED'
    )
    expect(retry2.shouldRetry).toBe(true)

    // Final failure
    const retry3 = await rateLimiter.scheduleRetry(
      { ...sendRequest, retry_count: 3 }, 
      'RATE_LIMIT_EXCEEDED'
    )
    expect(retry3.shouldRetry).toBe(false)
    expect(retry3.finalFailure).toBe(true)
  })

  it('should distribute load across multiple accounts', async () => {
    const accounts = [
      { id: 'account-1', email: 'test1@example.com', warmup_status: 'completed' },
      { id: 'account-2', email: 'test2@example.com', warmup_status: 'completed' },
      { id: 'account-3', email: 'test3@example.com', warmup_status: 'completed' }
    ]

    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ data: accounts, error: null }))
        }))
      }))
    })

    // Mock different quota levels for each account
    jest.spyOn(rateLimiter, 'checkSendingQuota')
      .mockResolvedValueOnce({
        account_id: 'account-1',
        daily_remaining: 10,
        hourly_remaining: 5,
        domain_limits: { 'example.com': 2 },
        next_available_slot: new Date().toISOString(),
        is_available: true,
        burst_available: 3
      })
      .mockResolvedValueOnce({
        account_id: 'account-2',
        daily_remaining: 25, // Best option
        hourly_remaining: 8,
        domain_limits: { 'example.com': 5 },
        next_available_slot: new Date().toISOString(),
        is_available: true,
        burst_available: 5
      })
      .mockResolvedValueOnce({
        account_id: 'account-3',
        daily_remaining: 15,
        hourly_remaining: 6,
        domain_limits: { 'example.com': 3 },
        next_available_slot: new Date().toISOString(),
        is_available: true,
        burst_available: 4
      })

    const strategy: DistributionStrategy = { type: 'least_used' }
    const selection = await rateLimiter.selectEmailAccount('user-1', 'example.com', strategy)

    expect(selection?.accountId).toBe('account-2') // Account with most remaining quota
  })
})