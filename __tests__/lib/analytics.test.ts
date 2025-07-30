import { Analytics } from '../../lib/analytics'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({ data: null, error: null })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({ data: [], error: null }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null }))
          }))
        })),
        limit: jest.fn(() => ({ data: [], error: null }))
      })),
      gte: jest.fn(() => ({
        lte: jest.fn(() => ({ data: [], error: null })),
        lt: jest.fn(() => ({ data: [], error: null }))
      })),
      like: jest.fn(() => ({
        gte: jest.fn(() => ({ data: [], error: null }))
      })),
      in: jest.fn(() => ({ data: [], error: null })),
      or: jest.fn(() => ({ data: [], error: null })),
      order: jest.fn(() => ({
        limit: jest.fn(() => ({ data: [], error: null })),
        single: jest.fn(() => ({ data: null, error: null }))
      })),
      filter: jest.fn(() => ({ data: [], error: null }))
    })),
    insert: jest.fn(() => ({ data: null, error: null }))
  }))
}

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}

describe('Analytics', () => {
  let analytics: Analytics

  beforeEach(() => {
    jest.clearAllMocks()
    analytics = new Analytics(mockSupabase, mockRedis)
  })

  describe('getCampaignAnalytics', () => {
    it('should get comprehensive campaign analytics', async () => {
      // Mock campaign data
      const mockCampaign = {
        id: 'campaign_123',
        name: 'Test Campaign',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }

      // Mock email sends
      const mockSends = [
        { id: '1', success: true, created_at: '2024-01-01T10:00:00Z' },
        { id: '2', success: true, created_at: '2024-01-01T11:00:00Z' },
        { id: '3', success: false, created_at: '2024-01-01T12:00:00Z' }
      ]

      // Mock email events
      const mockEvents = [
        { type: 'opened', timestamp: '2024-01-01T10:30:00Z' },
        { type: 'clicked', timestamp: '2024-01-01T10:45:00Z' },
        { type: 'bounced', timestamp: '2024-01-01T12:00:00Z' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockCampaign, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  lte: jest.fn(() => ({ data: mockSends, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  lte: jest.fn(() => ({ data: mockEvents, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'ab_tests') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ data: [], error: null }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }
      })

      const result = await analytics.getCampaignAnalytics('campaign_123')

      expect(result.campaignId).toBe('campaign_123')
      expect(result.campaignName).toBe('Test Campaign')
      expect(result.status).toBe('active')
      expect(result.metrics.sent).toBe(3)
      expect(result.metrics.delivered).toBe(2)
      expect(result.metrics.opened).toBe(1)
      expect(result.metrics.clicked).toBe(1)
      expect(result.metrics.bounced).toBe(1)
      expect(result.rates.deliveryRate).toBe(2/3)
      expect(result.rates.openRate).toBe(0.5)
      expect(result.rates.clickRate).toBe(0.5)
      expect(result.engagement).toBeDefined()
      expect(result.abTests).toBeInstanceOf(Array)
      expect(result.revenue).toBeDefined()
    })

    it('should handle campaign not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      }))

      await expect(
        analytics.getCampaignAnalytics('invalid_campaign')
      ).rejects.toThrow('Campaign not found')
    })

    it('should use custom date range when provided', async () => {
      const mockCampaign = {
        id: 'campaign_123',
        name: 'Test Campaign',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockCampaign, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lte: jest.fn(() => ({ data: [], error: null }))
              }))
            }))
          }))
        }
      })

      const customRange = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z'
      }

      const result = await analytics.getCampaignAnalytics('campaign_123', customRange)

      expect(result.dateRange).toEqual(customRange)
    })
  })

  describe('getContactAnalytics', () => {
    it('should get comprehensive contact analytics', async () => {
      const mockContact = {
        id: 'contact_123',
        email: 'test@example.com',
        tags: ['vip', 'customer'],
        list_id: 'list_123',
        custom_fields: { company: 'Test Corp' }
      }

      const mockSends = [
        { id: '1', created_at: '2024-01-01T10:00:00Z' },
        { id: '2', created_at: '2024-01-02T10:00:00Z' }
      ]

      const mockEvents = [
        { type: 'opened', timestamp: '2024-01-01T10:30:00Z' },
        { type: 'clicked', timestamp: '2024-01-01T10:45:00Z' },
        { type: 'replied', timestamp: '2024-01-01T11:00:00Z' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'contacts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockContact, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({ data: mockSends, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({ data: mockEvents, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getContactAnalytics('contact_123')

      expect(result.contactId).toBe('contact_123')
      expect(result.email).toBe('test@example.com')
      expect(result.engagementScore).toBeGreaterThan(0)
      expect(result.lifecycle.totalEmails).toBe(2)
      expect(result.lifecycle.totalOpens).toBe(1)
      expect(result.lifecycle.totalClicks).toBe(1)
      expect(result.lifecycle.totalReplies).toBe(1)
      expect(result.behavior).toBeDefined()
      expect(result.segmentation.tags).toEqual(['vip', 'customer'])
      expect(result.predictive).toBeDefined()
      expect(result.predictive.churnRisk).toBeGreaterThanOrEqual(0)
      expect(result.predictive.churnRisk).toBeLessThanOrEqual(1)
      expect(result.predictive.conversionProbability).toBeGreaterThanOrEqual(0)
      expect(result.predictive.conversionProbability).toBeLessThanOrEqual(1)
    })

    it('should handle contact not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Not found') }))
          }))
        }))
      }))

      await expect(
        analytics.getContactAnalytics('invalid_contact')
      ).rejects.toThrow('Contact not found')
    })

    it('should calculate engagement score correctly', async () => {
      const mockContact = {
        id: 'contact_123',
        email: 'test@example.com',
        tags: [],
        custom_fields: {}
      }

      // High engagement contact
      const mockSends = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        created_at: `2024-01-0${(i % 9) + 1}T10:00:00Z`
      }))

      const mockEvents = [
        ...Array.from({ length: 8 }, (_, i) => ({ type: 'opened', timestamp: `2024-01-0${(i % 8) + 1}T10:30:00Z` })),
        ...Array.from({ length: 5 }, (_, i) => ({ type: 'clicked', timestamp: `2024-01-0${(i % 5) + 1}T10:45:00Z` })),
        ...Array.from({ length: 2 }, (_, i) => ({ type: 'replied', timestamp: `2024-01-0${(i % 2) + 1}T11:00:00Z` }))
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'contacts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockContact, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({ data: mockSends, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({ data: mockEvents, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getContactAnalytics('contact_123')

      expect(result.engagementScore).toBeGreaterThan(50) // High engagement
      expect(result.predictive.churnRisk).toBeLessThan(0.5) // Low churn risk
      expect(result.predictive.conversionProbability).toBeGreaterThan(0.1) // Higher conversion probability
    })
  })

  describe('getDomainAnalytics', () => {
    it('should get domain performance analytics', async () => {
      const mockReputation = {
        domain: 'example.com',
        overall_score: 85,
        factors: {
          deliverabilityScore: 90,
          bounceRate: 0.02,
          complaintRate: 0.001
        }
      }

      const mockSends = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        success: i < 95, // 95% success rate
        created_at: `2024-01-${String(Math.floor(i / 3) + 1).padStart(2, '0')}T10:00:00Z`
      }))

      const mockEvents = [
        ...Array.from({ length: 5 }, (_, i) => ({ type: 'bounced', timestamp: `2024-01-0${i + 1}T10:30:00Z` })),
        ...Array.from({ length: 1 }, (_, i) => ({ type: 'complained', timestamp: `2024-01-0${i + 1}T11:00:00Z` }))
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'reputation_scores') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => ({ data: mockReputation, error: null }))
                  }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              like: jest.fn(() => ({
                gte: jest.fn(() => ({ data: mockSends, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              like: jest.fn(() => ({
                gte: jest.fn(() => ({ data: mockEvents, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getDomainAnalytics('example.com')

      expect(result.domain).toBe('example.com')
      expect(result.reputation.score).toBe(85)
      expect(result.reputation.trend).toMatch(/^(improving|stable|declining)$/)
      expect(result.performance).toBeDefined()
      expect(result.performance.deliveryRate).toBeCloseTo(0.95)
      expect(result.volume).toBeDefined()
      expect(result.volume.monthlyTotal).toBe(100)
      expect(result.issues).toBeInstanceOf(Array)
    })

    it('should identify domain issues correctly', async () => {
      const mockSends = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        success: i < 85, // 85% success rate (high bounce rate)
        created_at: `2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`
      }))

      const mockEvents = [
        ...Array.from({ length: 15 }, (_, i) => ({ type: 'bounced', timestamp: `2024-01-01T${String(i % 24).padStart(2, '0')}:30:00Z` })),
        ...Array.from({ length: 5 }, (_, i) => ({ type: 'complained', timestamp: `2024-01-01T${String(i % 24).padStart(2, '0')}:45:00Z` }))
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'reputation_scores') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => ({ data: null, error: null }))
                  }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              like: jest.fn(() => ({
                gte: jest.fn(() => ({ data: mockSends, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              like: jest.fn(() => ({
                gte: jest.fn(() => ({ data: mockEvents, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getDomainAnalytics('example.com')

      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.some(issue => issue.type === 'bounce_rate')).toBe(true)
      expect(result.issues.some(issue => issue.type === 'complaint_rate')).toBe(true)
    })
  })

  describe('getTimeSeriesData', () => {
    it('should generate time series data with daily grouping', async () => {
      const query = {
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-03T00:00:00Z'
        },
        groupBy: 'day' as const
      }

      // Mock data for different days
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({ data: [{ success: true }], error: null }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({ data: [{ type: 'opened' }], error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getTimeSeriesData(query)

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('timestamp')
      expect(result[0]).toHaveProperty('metrics')
      expect(result[0].metrics).toHaveProperty('sent')
      expect(result[0].metrics).toHaveProperty('opened')
    })

    it('should filter by campaign IDs when provided', async () => {
      const query = {
        campaignIds: ['campaign_1', 'campaign_2'],
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-02T00:00:00Z'
        }
      }

      let sendsQueryCalled = false
      let eventsQueryCalled = false

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
                  in: jest.fn((field, values) => {
                    if (field === 'campaign_id') {
                      sendsQueryCalled = true
                      expect(values).toEqual(['campaign_1', 'campaign_2'])
                    }
                    return { data: [], error: null }
                  })
                }))
              }))
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
                  in: jest.fn((field, values) => {
                    if (field === 'campaign_id') {
                      eventsQueryCalled = true
                      expect(values).toEqual(['campaign_1', 'campaign_2'])
                    }
                    return { data: [], error: null }
                  })
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      await analytics.getTimeSeriesData(query)

      expect(sendsQueryCalled).toBe(true)
      expect(eventsQueryCalled).toBe(true)
    })

    it('should validate query parameters', async () => {
      const invalidQuery = {
        dateRange: {
          startDate: 'invalid-date',
          endDate: '2024-01-02T00:00:00Z'
        }
      }

      await expect(
        analytics.getTimeSeriesData(invalidQuery as any)
      ).rejects.toThrow()
    })
  })

  describe('generateReport', () => {
    it('should generate campaign report', async () => {
      const mockCampaign = {
        id: 'campaign_123',
        name: 'Test Campaign',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockCampaign, error: null }))
              }))
            }))
          }
        }
        if (table === 'analytics_reports') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }
      })

      const options = {
        id: 'campaign_123',
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        },
        format: 'json' as const
      }

      const result = await analytics.generateReport('campaign', options)

      expect(result.id).toMatch(/^report_/)
      expect(result.type).toBe('campaign')
      expect(result.title).toContain('Campaign Analytics Report')
      expect(result.dateRange).toEqual(options.dateRange)
      expect(result.data).toBeDefined()
      expect(result.charts).toBeInstanceOf(Array)
      expect(result.insights).toBeInstanceOf(Array)
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.format).toBe('json')
    })

    it('should require ID for campaign report', async () => {
      const options = {
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        }
      }

      await expect(
        analytics.generateReport('campaign', options)
      ).rejects.toThrow('Campaign ID required for campaign report')
    })

    it('should generate overview report without ID', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'analytics_reports') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const options = {
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        }
      }

      const result = await analytics.generateReport('overview', options)

      expect(result.type).toBe('overview')
      expect(result.title).toBe('Overview Analytics Report')
    })
  })

  describe('getRealTimeMetrics', () => {
    it('should get real-time metrics', async () => {
      const mockTodaySends = Array.from({ length: 50 }, (_, i) => ({ id: `${i + 1}` }))
      const mockHourSends = Array.from({ length: 5 }, (_, i) => ({ id: `${i + 1}` }))
      const mockTodayEvents = [
        ...Array.from({ length: 20 }, () => ({ type: 'opened' })),
        ...Array.from({ length: 8 }, () => ({ type: 'clicked' }))
      ]
      const mockActiveCampaigns = [
        { id: 'campaign_1', name: 'Campaign 1' },
        { id: 'campaign_2', name: 'Campaign 2' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn((field, value) => {
                // Determine if this is today or hour query based on the timestamp
                const isHourQuery = new Date(value).getTime() > Date.now() - 2 * 60 * 60 * 1000
                return { data: isHourQuery ? mockHourSends : mockTodaySends, error: null }
              })
            }))
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({ data: mockTodayEvents, error: null }))
            }))
          }
        }
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ data: mockActiveCampaigns, error: null }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({ data: [], error: null }))
        }
      })

      const result = await analytics.getRealTimeMetrics()

      expect(result.emailsSentToday).toBe(50)
      expect(result.emailsSentThisHour).toBe(5)
      expect(result.currentOpenRate).toBe(20/50) // 20 opens out of 50 sends
      expect(result.currentClickRate).toBe(8/50) // 8 clicks out of 50 sends
      expect(result.activeCampaigns).toBe(2)
      expect(result.topPerformingCampaign).toBeDefined()
      expect(result.recentActivity).toBeInstanceOf(Array)
    })

    it('should handle zero sends gracefully', async () => {
      mockSupabase.from.mockImplementation((table) => {
        return {
          select: jest.fn(() => ({
            gte: jest.fn(() => ({ data: [], error: null })),
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }
      })

      const result = await analytics.getRealTimeMetrics()

      expect(result.emailsSentToday).toBe(0)
      expect(result.emailsSentThisHour).toBe(0)
      expect(result.currentOpenRate).toBe(0)
      expect(result.currentClickRate).toBe(0)
      expect(result.activeCampaigns).toBe(0)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      }))

      await expect(
        analytics.getCampaignAnalytics('campaign_123')
      ).rejects.toThrow('Campaign not found')
    })

    it('should handle empty data sets', async () => {
      const mockCampaign = {
        id: 'campaign_123',
        name: 'Empty Campaign',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockCampaign, error: null }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }
      })

      const result = await analytics.getCampaignAnalytics('campaign_123')

      expect(result.metrics.sent).toBe(0)
      expect(result.metrics.delivered).toBe(0)
      expect(result.rates.deliveryRate).toBe(0)
      expect(result.rates.openRate).toBe(0)
    })

    it('should calculate rates correctly with zero denominators', async () => {
      const mockCampaign = {
        id: 'campaign_123',
        name: 'Test Campaign',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }

      // Mock sends with no successful deliveries
      const mockSends = [
        { id: '1', success: false },
        { id: '2', success: false }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'campaigns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: mockCampaign, error: null }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  lte: jest.fn(() => ({ data: mockSends, error: null }))
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: [], error: null }))
          }))
        }
      })

      const result = await analytics.getCampaignAnalytics('campaign_123')

      expect(result.rates.openRate).toBe(0) // Should handle division by zero
      expect(result.rates.clickRate).toBe(0)
      expect(result.rates.deliveryRate).toBe(0)
    })
  })
})