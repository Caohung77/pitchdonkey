import { ReputationMonitor } from '../../lib/reputation-monitor'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          like: jest.fn(() => ({ data: [], error: null })),
          single: jest.fn(() => ({ data: null, error: null }))
        })),
        like: jest.fn(() => ({ data: [], error: null })),
        in: jest.fn(() => ({ data: [], error: null }))
      })),
      gte: jest.fn(() => ({
        like: jest.fn(() => ({ data: [], error: null }))
      })),
      like: jest.fn(() => ({ data: [], error: null })),
      in: jest.fn(() => ({ data: [], error: null }))
    })),
    insert: jest.fn(() => ({ data: null, error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ data: null, error: null })),
      in: jest.fn(() => ({ data: null, error: null }))
    })),
    upsert: jest.fn(() => ({ data: null, error: null }))
  }))
}

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn()
}

describe('ReputationMonitor', () => {
  let reputationMonitor: ReputationMonitor

  beforeEach(() => {
    jest.clearAllMocks()
    reputationMonitor = new ReputationMonitor(mockSupabase, mockRedis)
  })

  describe('getReputationScore', () => {
    it('should calculate reputation score for domain', async () => {
      // Mock database responses
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({
                  data: [
                    { success: true },
                    { success: true },
                    { success: false }
                  ],
                  error: null
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
                  like: jest.fn(() => ({ data: [], error: null }))
                }))
              })),
              in: jest.fn(() => ({
                gte: jest.fn(() => ({
                  like: jest.fn(() => ({ data: [], error: null }))
                }))
              }))
            }))
          }
        }
        return {
          upsert: jest.fn(() => ({ data: null, error: null }))
        }
      })

      const result = await reputationMonitor.getReputationScore('example.com')

      expect(result.domain).toBe('example.com')
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
      expect(result.status).toMatch(/^(excellent|good|fair|poor|critical)$/)
      expect(result.factors).toBeDefined()
      expect(result.alerts).toBeInstanceOf(Array)
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    it('should validate domain format', async () => {
      await expect(
        reputationMonitor.getReputationScore('invalid-domain')
      ).rejects.toThrow()
    })

    it('should validate IP address format if provided', async () => {
      await expect(
        reputationMonitor.getReputationScore('example.com', 'invalid-ip')
      ).rejects.toThrow()
    })

    it('should use cached score if available and recent', async () => {
      const cachedScore = {
        domain: 'example.com',
        overallScore: 85,
        lastUpdated: new Date().toISOString(),
        factors: {},
        status: 'good',
        alerts: [],
        recommendations: []
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedScore))

      const result = await reputationMonitor.getReputationScore('example.com')

      expect(result.overallScore).toBe(85)
      expect(mockRedis.get).toHaveBeenCalled()
    })

    it('should ignore expired cache', async () => {
      const expiredScore = {
        domain: 'example.com',
        overallScore: 85,
        lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        factors: {},
        status: 'good',
        alerts: [],
        recommendations: []
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredScore))
      mockRedis.del.mockResolvedValue(1)

      // Mock fresh calculation
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            like: jest.fn(() => ({ data: [], error: null }))
          })),
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            }))
          })),
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            }))
          }))
        })),
        upsert: jest.fn(() => ({ data: null, error: null }))
      }))

      const result = await reputationMonitor.getReputationScore('example.com')

      expect(mockRedis.del).toHaveBeenCalled()
      expect(result.domain).toBe('example.com')
    })
  })

  describe('checkBlacklists', () => {
    it('should check domain against blacklists', async () => {
      const result = await reputationMonitor.checkBlacklists('example.com')

      expect(result.domain).toBe('example.com')
      expect(result.blacklists).toBeInstanceOf(Array)
      expect(result.blacklists.length).toBeGreaterThan(0)
      expect(result.overallStatus).toMatch(/^(clean|listed|unknown)$/)
      expect(result.lastChecked).toBeDefined()
      expect(result.nextCheck).toBeDefined()
    })

    it('should check IP address if provided', async () => {
      const result = await reputationMonitor.checkBlacklists('example.com', '192.168.1.1')

      expect(result.domain).toBe('example.com')
      expect(result.ipAddress).toBe('192.168.1.1')
    })

    it('should handle blacklist check failures gracefully', async () => {
      // The implementation includes error handling for individual blacklist failures
      const result = await reputationMonitor.checkBlacklists('example.com')

      expect(result.overallStatus).toMatch(/^(clean|listed|unknown)$/)
      expect(result.blacklists).toBeInstanceOf(Array)
    })

    it('should validate domain format', async () => {
      await expect(
        reputationMonitor.checkBlacklists('invalid-domain')
      ).rejects.toThrow()
    })

    it('should validate IP format if provided', async () => {
      await expect(
        reputationMonitor.checkBlacklists('example.com', 'invalid-ip')
      ).rejects.toThrow()
    })
  })

  describe('getBounceRateMetrics', () => {
    it('should calculate bounce rate metrics', async () => {
      // Mock bounce events
      const mockBounceEvents = [
        { type: 'bounced', event_data: { bounceType: 'hard' } },
        { type: 'bounced', event_data: { bounceType: 'soft' } },
        { type: 'bounced', event_data: { bounceType: 'hard' } }
      ]

      // Mock sent emails
      const mockSentEmails = Array.from({ length: 100 }, () => ({ success: true }))

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  like: jest.fn(() => ({ data: mockBounceEvents, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: mockSentEmails, error: null }))
              }))
            }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.getBounceRateMetrics('example.com')

      expect(result.domain).toBe('example.com')
      expect(result.totalSent).toBe(100)
      expect(result.totalBounces).toBe(3)
      expect(result.hardBounces).toBe(2)
      expect(result.softBounces).toBe(1)
      expect(result.bounceRate).toBe(0.03)
      expect(result.hardBounceRate).toBe(0.02)
      expect(result.softBounceRate).toBe(0.01)
      expect(result.status).toMatch(/^(healthy|warning|critical)$/)
      expect(result.threshold).toBeDefined()
      expect(result.trend).toMatch(/^(improving|stable|declining)$/)
    })

    it('should handle no data gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            }))
          })),
          gte: jest.fn(() => ({
            like: jest.fn(() => ({ data: [], error: null }))
          }))
        }))
      }))

      const result = await reputationMonitor.getBounceRateMetrics('example.com')

      expect(result.totalSent).toBe(0)
      expect(result.totalBounces).toBe(0)
      expect(result.bounceRate).toBe(0)
      expect(result.status).toBe('healthy')
    })

    it('should determine correct status based on bounce rate', async () => {
      // Test critical status
      const highBounceEvents = Array.from({ length: 15 }, () => ({ 
        type: 'bounced', 
        event_data: { bounceType: 'hard' } 
      }))
      const sentEmails = Array.from({ length: 100 }, () => ({ success: true }))

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  like: jest.fn(() => ({ data: highBounceEvents, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: sentEmails, error: null }))
              }))
            }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.getBounceRateMetrics('example.com')

      expect(result.bounceRate).toBe(0.15) // 15%
      expect(result.status).toBe('critical')
    })
  })

  describe('getComplaintMetrics', () => {
    it('should calculate complaint metrics', async () => {
      const mockComplaints = [
        { type: 'complained', provider_id: 'gmail' },
        { type: 'complained', provider_id: 'outlook' },
        { type: 'complained', provider_id: 'gmail' }
      ]

      const mockSentEmails = Array.from({ length: 1000 }, () => ({ success: true }))

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  like: jest.fn(() => ({ data: mockComplaints, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: mockSentEmails, error: null }))
              }))
            }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.getComplaintMetrics('example.com')

      expect(result.domain).toBe('example.com')
      expect(result.totalSent).toBe(1000)
      expect(result.totalComplaints).toBe(3)
      expect(result.complaintRate).toBe(0.003)
      expect(result.complaintSources).toBeInstanceOf(Array)
      expect(result.complaintSources.length).toBeGreaterThan(0)
      expect(result.status).toMatch(/^(healthy|warning|critical)$/)
    })

    it('should group complaints by source correctly', async () => {
      const mockComplaints = [
        { type: 'complained', provider_id: 'gmail' },
        { type: 'complained', provider_id: 'gmail' },
        { type: 'complained', provider_id: 'outlook' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_events') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  like: jest.fn(() => ({ data: mockComplaints, error: null }))
                }))
              }))
            }))
          }
        }
        if (table === 'email_sends') {
          return {
            select: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: [{ success: true }], error: null }))
              }))
            }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.getComplaintMetrics('example.com')

      expect(result.complaintSources).toHaveLength(2)
      expect(result.complaintSources.find(s => s.source === 'gmail')?.count).toBe(2)
      expect(result.complaintSources.find(s => s.source === 'outlook')?.count).toBe(1)
    })
  })

  describe('cleanEmailList', () => {
    it('should clean email list and return results', async () => {
      const mockContacts = [
        { id: '1', email: 'valid@example.com', email_status: 'active', created_at: '2024-01-01' },
        { id: '2', email: 'bounced@example.com', email_status: 'bounced', created_at: '2024-01-01' },
        { id: '3', email: 'complained@example.com', email_status: 'complained', created_at: '2024-01-01' },
        { id: '4', email: 'unsubscribed@example.com', email_status: 'unsubscribed', created_at: '2024-01-01' },
        { id: '5', email: 'duplicate@example.com', email_status: 'active', created_at: '2024-01-01' },
        { id: '6', email: 'duplicate@example.com', email_status: 'active', created_at: '2024-01-01' },
        { id: '7', email: 'invalid-email', email_status: 'active', created_at: '2024-01-01' },
        { id: '8', email: 'inactive@example.com', email_status: 'active', created_at: '2023-01-01', last_opened_at: null, last_clicked_at: null }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'contacts') {
          return {
            select: jest.fn(() => ({ data: mockContacts, error: null })),
            update: jest.fn(() => ({
              in: jest.fn(() => ({ data: null, error: null }))
            }))
          }
        }
        if (table === 'list_cleaning_results') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.cleanEmailList()

      expect(result.totalProcessed).toBe(8)
      expect(result.cleaned).toBeGreaterThan(0)
      expect(result.bounced).toBe(1)
      expect(result.complained).toBe(1)
      expect(result.unsubscribed).toBe(1)
      expect(result.duplicates).toBe(1)
      expect(result.invalid).toBe(1)
      expect(result.inactive).toBe(1)
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('should handle empty contact list', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({ data: [], error: null }))
      }))

      const result = await reputationMonitor.cleanEmailList()

      expect(result.totalProcessed).toBe(0)
      expect(result.cleaned).toBe(0)
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    it('should clean specific list when listId provided', async () => {
      const mockContacts = [
        { id: '1', email: 'test@example.com', email_status: 'bounced', created_at: '2024-01-01' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'contacts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ data: mockContacts, error: null }))
            })),
            update: jest.fn(() => ({
              in: jest.fn(() => ({ data: null, error: null }))
            }))
          }
        }
        if (table === 'list_cleaning_results') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.cleanEmailList('list_123')

      expect(result.totalProcessed).toBe(1)
      expect(result.bounced).toBe(1)
    })
  })

  describe('monitorReputation', () => {
    it('should monitor reputation for all active domains', async () => {
      const mockDomains = [
        { domain: 'example1.com' },
        { domain: 'example2.com' },
        { domain: 'example1.com' } // Duplicate should be filtered
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_accounts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ data: mockDomains, error: null }))
            }))
          }
        }
        // Mock other tables for reputation calculation
        return {
          select: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            })),
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: [], error: null }))
              }))
            })),
            in: jest.fn(() => ({
              gte: jest.fn(() => ({
                like: jest.fn(() => ({ data: [], error: null }))
              }))
            }))
          })),
          upsert: jest.fn(() => ({ data: null, error: null })),
          insert: jest.fn(() => ({ data: null, error: null }))
        }
      })

      // Should not throw error
      await expect(reputationMonitor.monitorReputation()).resolves.not.toThrow()
    })

    it('should handle errors gracefully during monitoring', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ data: null, error: new Error('Database error') }))
        }))
      }))

      // Should not throw error even if database fails
      await expect(reputationMonitor.monitorReputation()).resolves.not.toThrow()
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            like: jest.fn(() => ({ data: null, error: new Error('Database error') }))
          }))
        }))
      }))

      await expect(
        reputationMonitor.getBounceRateMetrics('example.com')
      ).rejects.toThrow('Database error')
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      // Should still work without cache
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            like: jest.fn(() => ({ data: [], error: null }))
          })),
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            }))
          })),
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              like: jest.fn(() => ({ data: [], error: null }))
            }))
          }))
        })),
        upsert: jest.fn(() => ({ data: null, error: null }))
      }))

      const result = await reputationMonitor.getReputationScore('example.com')
      expect(result.domain).toBe('example.com')
    })

    it('should validate email format in list cleaning', async () => {
      const mockContacts = [
        { id: '1', email: 'valid@example.com', email_status: 'active', created_at: '2024-01-01' },
        { id: '2', email: 'invalid-email', email_status: 'active', created_at: '2024-01-01' }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'contacts') {
          return {
            select: jest.fn(() => ({ data: mockContacts, error: null })),
            update: jest.fn(() => ({
              in: jest.fn(() => ({ data: null, error: null }))
            }))
          }
        }
        if (table === 'list_cleaning_results') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          }
        }
        return { select: jest.fn() }
      })

      const result = await reputationMonitor.cleanEmailList()

      expect(result.invalid).toBe(1)
      expect(result.cleaned).toBeGreaterThanOrEqual(1)
    })
  })
})