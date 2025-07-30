import { UsageMonitor } from '../../lib/usage-monitor'
import { subscriptionManager } from '../../lib/subscription'

// Mock subscription manager
jest.mock('../../lib/subscription')
const mockSubscriptionManager = subscriptionManager as jest.Mocked<typeof subscriptionManager>

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn()
  }))
}

// Mock Redis client
const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn()
}

describe('UsageMonitor', () => {
  let usageMonitor: UsageMonitor

  beforeEach(() => {
    jest.clearAllMocks()
    usageMonitor = new UsageMonitor(mockSupabase, mockRedis)
  })

  describe('trackUsage', () => {
    it('should track usage and check limits', async () => {
      const mockLimitCheck = {
        withinLimits: true,
        exceededLimits: [],
        usage: { emailsSent: 100 },
        limits: { emailsPerMonth: 1000 }
      }

      mockSubscriptionManager.updateUsage.mockResolvedValue(undefined)
      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)

      await usageMonitor.trackUsage('user_123', 'emailsSent', 5)

      expect(mockSubscriptionManager.updateUsage).toHaveBeenCalledWith('user_123', 'emailsSent', 5)
      expect(mockSubscriptionManager.checkLimits).toHaveBeenCalledWith('user_123')
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'usage:user_123',
        300,
        JSON.stringify(mockLimitCheck.usage)
      )
    })

    it('should handle limit exceeded scenario', async () => {
      const mockLimitCheck = {
        withinLimits: false,
        exceededLimits: ['emailsPerMonth'],
        usage: { emailsSent: 1100 },
        limits: { emailsPerMonth: 1000 }
      }

      mockSubscriptionManager.updateUsage.mockResolvedValue(undefined)
      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)
      mockSupabase.from().single.mockResolvedValue({ data: { id: 'restriction_123' }, error: null })

      // Mock createAlert method
      jest.spyOn(usageMonitor, 'createAlert').mockResolvedValue({
        id: 'alert_123',
        userId: 'user_123',
        metric: 'emailsPerMonth',
        threshold: 100,
        currentUsage: 1100,
        alertType: 'limit_exceeded',
        isActive: true,
        createdAt: new Date().toISOString()
      })

      await usageMonitor.trackUsage('user_123', 'emailsSent', 5)

      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          feature: 'send_email',
          is_restricted: true,
          reason: "You've exceeded your emailsPerMonth limit"
        }),
        { onConflict: 'user_id,feature' }
      )
    })

    it('should create warning alerts at 80% threshold', async () => {
      const mockLimitCheck = {
        withinLimits: true,
        exceededLimits: [],
        usage: { emailsSent: 850 }, // 85% of 1000
        limits: { emailsPerMonth: 1000 }
      }

      mockSubscriptionManager.updateUsage.mockResolvedValue(undefined)
      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)
      mockSupabase.from().single.mockResolvedValue({ data: { id: 'alert_123' }, error: null })

      await usageMonitor.trackUsage('user_123', 'emailsSent', 5)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          metric: 'emailsSent',
          alert_type: 'warning',
          threshold: 80
        })
      )
    })
  })

  describe('getUsageStatus', () => {
    it('should return complete usage status', async () => {
      const mockLimitCheck = {
        withinLimits: true,
        usage: { emailsSent: 500 },
        limits: { emailsPerMonth: 1000 }
      }

      const mockRestrictions = []
      const mockAlerts = []

      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)
      mockSupabase.from().single
        .mockResolvedValueOnce({ data: mockRestrictions, error: null }) // restrictions
        .mockResolvedValueOnce({ data: mockAlerts, error: null }) // alerts

      const status = await usageMonitor.getUsageStatus('user_123')

      expect(status).toEqual({
        usage: mockLimitCheck.usage,
        limits: mockLimitCheck.limits,
        restrictions: mockRestrictions,
        alerts: mockAlerts,
        withinLimits: true
      })
    })

    it('should use cached data when available', async () => {
      const cachedUsage = { emailsSent: 500 }
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedUsage))

      const mockLimitCheck = {
        withinLimits: true,
        usage: cachedUsage,
        limits: { emailsPerMonth: 1000 }
      }

      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)
      mockSupabase.from().single
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })

      await usageMonitor.getUsageStatus('user_123')

      expect(mockRedis.get).toHaveBeenCalledWith('usage:user_123')
    })
  })

  describe('canPerformAction', () => {
    it('should allow action when within limits', async () => {
      jest.spyOn(usageMonitor, 'getUsageStatus').mockResolvedValue({
        usage: { emailsSent: 500 },
        limits: { emailsPerMonth: 1000 },
        restrictions: [],
        alerts: [],
        withinLimits: true
      })

      const result = await usageMonitor.canPerformAction('user_123', 'send_email')

      expect(result).toEqual({ allowed: true })
    })

    it('should deny action when restricted', async () => {
      const mockRestriction = {
        userId: 'user_123',
        feature: 'send_email',
        isRestricted: true,
        reason: 'Limit exceeded',
        restrictedAt: new Date().toISOString(),
        canPurchaseAddon: true
      }

      jest.spyOn(usageMonitor, 'getUsageStatus').mockResolvedValue({
        usage: { emailsSent: 1100 },
        limits: { emailsPerMonth: 1000 },
        restrictions: [mockRestriction],
        alerts: [],
        withinLimits: false
      })

      const result = await usageMonitor.canPerformAction('user_123', 'send_email')

      expect(result).toEqual({
        allowed: false,
        reason: 'Limit exceeded',
        canPurchaseAddon: true,
        addonType: 'emails'
      })
    })

    it('should deny action when at limit', async () => {
      jest.spyOn(usageMonitor, 'getUsageStatus').mockResolvedValue({
        usage: { emailsSent: 1000 },
        limits: { emailsPerMonth: 1000 },
        restrictions: [],
        alerts: [],
        withinLimits: false
      })

      const result = await usageMonitor.canPerformAction('user_123', 'send_email')

      expect(result).toEqual({
        allowed: false,
        reason: "You've reached your send email limit of 1000",
        canPurchaseAddon: true,
        addonType: 'emails'
      })
    })

    it('should allow unlimited actions', async () => {
      jest.spyOn(usageMonitor, 'getUsageStatus').mockResolvedValue({
        usage: { emailsSent: 5000 },
        limits: { emailsPerMonth: -1 }, // unlimited
        restrictions: [],
        alerts: [],
        withinLimits: true
      })

      const result = await usageMonitor.canPerformAction('user_123', 'send_email')

      expect(result).toEqual({ allowed: true })
    })
  })

  describe('createAlert', () => {
    it('should create usage alert and notification', async () => {
      const mockAlert = {
        id: 'alert_123',
        user_id: 'user_123',
        metric: 'emailsSent',
        threshold: 80,
        current_usage: 800,
        alert_type: 'warning',
        is_active: true
      }

      mockSupabase.from().single
        .mockResolvedValueOnce({ data: mockAlert, error: null }) // alert creation
        .mockResolvedValueOnce({ data: null, error: null }) // notification creation

      const result = await usageMonitor.createAlert('user_123', 'emailsSent', 80, 800, 'warning')

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          metric: 'emailsSent',
          threshold: 80,
          current_usage: 800,
          alert_type: 'warning',
          is_active: true
        })
      )

      expect(result).toEqual(mockAlert)
    })
  })

  describe('createRestriction', () => {
    it('should create usage restriction', async () => {
      const mockRestriction = {
        id: 'restriction_123',
        user_id: 'user_123',
        feature: 'send_email',
        is_restricted: true,
        reason: 'Limit exceeded',
        can_purchase_addon: true
      }

      mockSupabase.from().single.mockResolvedValue({ data: mockRestriction, error: null })

      const result = await usageMonitor.createRestriction('user_123', 'send_email', 'Limit exceeded', true)

      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          feature: 'send_email',
          is_restricted: true,
          reason: 'Limit exceeded',
          can_purchase_addon: true
        }),
        { onConflict: 'user_id,feature' }
      )

      expect(mockRedis.setex).toHaveBeenCalledWith('restriction:user_123:send_email', 3600, 'true')
      expect(result).toEqual(mockRestriction)
    })
  })

  describe('removeRestriction', () => {
    it('should remove usage restriction', async () => {
      mockSupabase.from().single.mockResolvedValue({ data: null, error: null })

      await usageMonitor.removeRestriction('user_123', 'send_email')

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        is_restricted: false,
        removed_at: expect.any(String)
      })

      expect(mockRedis.del).toHaveBeenCalledWith('restriction:user_123:send_email')
    })
  })

  describe('purchaseAddon', () => {
    it('should purchase addon successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        stripeCustomerId: 'cus_123'
      }

      const mockAddon = {
        id: 'addon_123',
        user_id: 'user_123',
        addon_type: 'emails',
        quantity: 1000,
        price: 1000,
        status: 'completed'
      }

      mockSubscriptionManager.getUserSubscription.mockResolvedValue(mockSubscription as any)
      mockSupabase.from().single.mockResolvedValue({ data: mockAddon, error: null })

      const result = await usageMonitor.purchaseAddon('user_123', 'emails', 1000, 'pm_123')

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          addon_type: 'emails',
          quantity: 1000,
          price: 1000,
          status: 'completed'
        })
      )

      expect(result).toEqual(mockAddon)
    })

    it('should throw error when no subscription found', async () => {
      mockSubscriptionManager.getUserSubscription.mockResolvedValue(null)

      await expect(
        usageMonitor.purchaseAddon('user_123', 'emails', 1000, 'pm_123')
      ).rejects.toThrow('No active subscription found')
    })
  })

  describe('generateUsageReport', () => {
    it('should generate comprehensive usage report', async () => {
      const mockSubscription = {
        planId: 'starter'
      }

      const mockPlan = {
        name: 'Starter Plan'
      }

      const mockLimitCheck = {
        usage: {
          emailsSent: 800,
          contactsCount: 500
        },
        limits: {
          emailsPerMonth: 1000,
          contactsLimit: 1000
        }
      }

      const mockPreviousUsage = {
        emailsSent: 700,
        contactsCount: 450
      }

      const mockRestrictions = []
      const mockAlerts = []

      mockSubscriptionManager.checkLimits.mockResolvedValue(mockLimitCheck)
      mockSubscriptionManager.getUserSubscription.mockResolvedValue(mockSubscription as any)
      mockSubscriptionManager.getUsageMetrics.mockResolvedValue(mockPreviousUsage as any)

      mockSupabase.from().single
        .mockResolvedValueOnce({ data: mockPlan, error: null }) // plan
        .mockResolvedValueOnce({ data: mockRestrictions, error: null }) // restrictions
        .mockResolvedValueOnce({ data: mockAlerts, error: null }) // alerts

      const report = await usageMonitor.generateUsageReport('user_123')

      expect(report).toMatchObject({
        userId: 'user_123',
        planName: 'Starter Plan',
        metrics: expect.objectContaining({
          emailsSent: {
            used: 800,
            limit: 1000,
            percentage: 80,
            trend: 100
          },
          contactsCount: {
            used: 500,
            limit: 1000,
            percentage: 50,
            trend: 50
          }
        }),
        restrictions: mockRestrictions,
        alerts: mockAlerts,
        recommendations: expect.arrayContaining([
          expect.stringContaining('Consider upgrading your plan')
        ])
      })
    })
  })

  describe('getNotifications', () => {
    it('should return user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif_123',
          user_id: 'user_123',
          type: 'usage_warning',
          title: 'Usage Warning',
          message: 'You are approaching your limit',
          is_read: false,
          created_at: new Date().toISOString()
        }
      ]

      mockSupabase.from().single.mockResolvedValue({ data: mockNotifications, error: null })

      const notifications = await usageMonitor.getNotifications('user_123', 10)

      expect(mockSupabase.from).toHaveBeenCalledWith('usage_notifications')
      expect(notifications).toEqual(mockNotifications)
    })
  })

  describe('markNotificationRead', () => {
    it('should mark notification as read', async () => {
      mockSupabase.from().single.mockResolvedValue({ data: null, error: null })

      await usageMonitor.markNotificationRead('user_123', 'notif_123')

      expect(mockSupabase.from().update).toHaveBeenCalledWith({ is_read: true })
    })
  })

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert', async () => {
      mockSupabase.from().single.mockResolvedValue({ data: null, error: null })

      await usageMonitor.acknowledgeAlert('user_123', 'alert_123')

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        is_active: false,
        acknowledged_at: expect.any(String)
      })
    })
  })

  describe('getActiveAlerts', () => {
    it('should return active alerts for user', async () => {
      const mockAlerts = [
        {
          id: 'alert_123',
          user_id: 'user_123',
          metric: 'emailsSent',
          alert_type: 'warning',
          is_active: true
        }
      ]

      mockSupabase.from().single.mockResolvedValue({ data: mockAlerts, error: null })

      const alerts = await usageMonitor.getActiveAlerts('user_123')

      expect(mockSupabase.from).toHaveBeenCalledWith('usage_alerts')
      expect(alerts).toEqual(mockAlerts)
    })
  })

  describe('getActiveRestrictions', () => {
    it('should return active restrictions for user', async () => {
      const mockRestrictions = [
        {
          user_id: 'user_123',
          feature: 'send_email',
          is_restricted: true,
          reason: 'Limit exceeded'
        }
      ]

      mockSupabase.from().single.mockResolvedValue({ data: mockRestrictions, error: null })

      const restrictions = await usageMonitor.getActiveRestrictions('user_123')

      expect(mockSupabase.from).toHaveBeenCalledWith('usage_restrictions')
      expect(restrictions).toEqual(mockRestrictions)
    })
  })
})