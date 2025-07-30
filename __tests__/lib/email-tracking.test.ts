import { EmailTracker } from '../../lib/email-tracking'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({ limit: jest.fn() }))
      })),
      gte: jest.fn(() => ({ filter: jest.fn() })),
      filter: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn() })) }))
    })),
    update: jest.fn(() => ({ eq: jest.fn() })),
    delete: jest.fn(() => ({ eq: jest.fn() })),
    upsert: jest.fn()
  }))
}

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn()
}

describe('EmailTracker', () => {
  let emailTracker: EmailTracker

  beforeEach(() => {
    jest.clearAllMocks()
    emailTracker = new EmailTracker(mockSupabase, mockRedis)
  })

  describe('generateTrackingPixel', () => {
    it('should generate tracking pixel with required fields', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await emailTracker.generateTrackingPixel(
        'msg_123',
        'test@example.com',
        'campaign_123',
        'contact_123'
      )

      expect(result).toMatchObject({
        messageId: 'msg_123',
        recipientEmail: 'test@example.com',
        campaignId: 'campaign_123',
        contactId: 'contact_123',
        opened: false,
        openCount: 0
      })

      expect(result.id).toMatch(/^track_/)
      expect(result.createdAt).toBeDefined()
      expect(mockInsert).toHaveBeenCalledWith({
        id: result.id,
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        created_at: result.createdAt,
        opened: false,
        open_count: 0
      })
    })

    it('should handle optional campaign and contact IDs', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await emailTracker.generateTrackingPixel(
        'msg_123',
        'test@example.com'
      )

      expect(result.campaignId).toBeUndefined()
      expect(result.contactId).toBeUndefined()
    })

    it('should throw error if database insert fails', async () => {
      const mockInsert = jest.fn().mockRejectedValue(new Error('Database error'))
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      await expect(
        emailTracker.generateTrackingPixel('msg_123', 'test@example.com')
      ).rejects.toThrow('Database error')
    })
  })

  describe('trackOpen', () => {
    it('should track first email open successfully', async () => {
      const mockPixelData = {
        id: 'pixel_123',
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        opened: false,
        opened_at: null,
        open_count: 0
      }

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockPixelData, error: null })
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'tracking_pixels') {
          return { select: mockSelect, update: mockUpdate }
        }
        if (table === 'email_events') {
          return { insert: mockInsert }
        }
        if (table === 'contacts') {
          return { update: mockUpdate }
        }
        if (table === 'campaigns') {
          return { 
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: { stats: {} }, 
                  error: null 
                })
              })
            }),
            update: mockUpdate
          }
        }
        return { insert: mockInsert, select: mockSelect, update: mockUpdate }
      })

      const result = await emailTracker.trackOpen(
        'pixel_123',
        'Mozilla/5.0',
        '192.168.1.1'
      )

      expect(result).toEqual({
        success: true,
        firstOpen: true
      })

      // Verify tracking pixel was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        opened: true,
        opened_at: expect.any(String),
        open_count: 1,
        last_opened_at: expect.any(String),
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1'
      })

      // Verify event was stored
      expect(mockInsert).toHaveBeenCalledWith({
        id: expect.stringMatching(/^event_/),
        message_id: 'msg_123',
        type: 'opened',
        timestamp: expect.any(String),
        recipient_email: 'test@example.com',
        provider_id: 'tracking',
        event_data: {
          pixelId: 'pixel_123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          isFirstOpen: true
        },
        campaign_id: 'campaign_123',
        contact_id: 'contact_123'
      })
    })

    it('should track subsequent opens correctly', async () => {
      const mockPixelData = {
        id: 'pixel_123',
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        opened: true,
        opened_at: '2024-01-01T10:00:00Z',
        open_count: 2
      }

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockPixelData, error: null })
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'tracking_pixels') {
          return { select: mockSelect, update: mockUpdate }
        }
        return { insert: mockInsert, select: mockSelect, update: mockUpdate }
      })

      const result = await emailTracker.trackOpen('pixel_123')

      expect(result).toEqual({
        success: true,
        firstOpen: false
      })

      // Verify open count was incremented
      expect(mockUpdate).toHaveBeenCalledWith({
        opened: true,
        opened_at: '2024-01-01T10:00:00Z', // Should preserve original opened_at
        open_count: 3, // Should increment
        last_opened_at: expect.any(String),
        user_agent: undefined,
        ip_address: undefined
      })
    })

    it('should handle pixel not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await emailTracker.trackOpen('invalid_pixel')

      expect(result).toEqual({
        success: false,
        firstOpen: false
      })
    })
  })

  describe('generateClickTrackingUrl', () => {
    it('should generate click tracking URL', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      // Mock environment variable
      process.env.TRACKING_DOMAIN = 'https://track.example.com'

      const result = await emailTracker.generateClickTrackingUrl(
        'msg_123',
        'test@example.com',
        'https://example.com/page',
        'campaign_123',
        'contact_123'
      )

      expect(result).toMatch(/^https:\/\/track\.example\.com\/click\/track_/)

      expect(mockInsert).toHaveBeenCalledWith({
        id: expect.stringMatching(/^track_/),
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        original_url: 'https://example.com/page',
        tracking_url: result,
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        created_at: expect.any(String),
        clicked: false,
        click_count: 0
      })
    })
  })

  describe('trackClick', () => {
    it('should track first click successfully', async () => {
      const mockClickData = {
        id: 'click_123',
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        original_url: 'https://example.com/page',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        clicked: false,
        clicked_at: null,
        click_count: 0
      }

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockClickData, error: null })
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'click_tracking') {
          return { select: mockSelect, update: mockUpdate }
        }
        return { insert: mockInsert, select: mockSelect, update: mockUpdate }
      })

      const result = await emailTracker.trackClick(
        'click_123',
        'Mozilla/5.0',
        '192.168.1.1'
      )

      expect(result).toEqual({
        success: true,
        redirectUrl: 'https://example.com/page',
        firstClick: true
      })

      // Verify click tracking was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        clicked: true,
        clicked_at: expect.any(String),
        click_count: 1,
        last_clicked_at: expect.any(String),
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1'
      })
    })

    it('should handle click not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await emailTracker.trackClick('invalid_click')

      expect(result).toEqual({
        success: false,
        redirectUrl: '',
        firstClick: false
      })
    })
  })

  describe('generateUnsubscribeToken', () => {
    it('should generate unsubscribe token', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await emailTracker.generateUnsubscribeToken(
        'test@example.com',
        'campaign_123',
        'contact_123'
      )

      expect(result).toMatchObject({
        recipientEmail: 'test@example.com',
        campaignId: 'campaign_123',
        contactId: 'contact_123',
        used: false
      })

      expect(result.id).toMatch(/^track_/)
      expect(result.token).toMatch(/^unsub_/)
      expect(result.createdAt).toBeDefined()

      expect(mockInsert).toHaveBeenCalledWith({
        id: result.id,
        token: result.token,
        recipient_email: 'test@example.com',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        created_at: result.createdAt,
        used: false
      })
    })
  })

  describe('processUnsubscribe', () => {
    it('should process unsubscribe successfully', async () => {
      const mockTokenData = {
        id: 'token_123',
        token: 'unsub_token_123',
        recipient_email: 'test@example.com',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        used: false
      }

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockTokenData, error: null })
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'unsubscribe_tokens') {
          return { select: mockSelect, update: mockUpdate }
        }
        return { insert: mockInsert, select: mockSelect, update: mockUpdate }
      })

      const result = await emailTracker.processUnsubscribe(
        'unsub_token_123',
        '192.168.1.1',
        'Mozilla/5.0'
      )

      expect(result).toEqual({
        success: true,
        email: 'test@example.com',
        alreadyUnsubscribed: false
      })

      // Verify token was marked as used
      expect(mockUpdate).toHaveBeenCalledWith({
        used: true,
        used_at: expect.any(String),
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0'
      })

      // Verify contact was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        email_status: 'unsubscribed',
        unsubscribed_at: expect.any(String)
      })
    })

    it('should handle already unsubscribed token', async () => {
      const mockTokenData = {
        id: 'token_123',
        token: 'unsub_token_123',
        recipient_email: 'test@example.com',
        used: true,
        used_at: '2024-01-01T10:00:00Z'
      }

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockTokenData, error: null })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await emailTracker.processUnsubscribe('unsub_token_123')

      expect(result).toEqual({
        success: true,
        email: 'test@example.com',
        alreadyUnsubscribed: true
      })
    })

    it('should handle invalid token', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await emailTracker.processUnsubscribe('invalid_token')

      expect(result).toEqual({
        success: false,
        alreadyUnsubscribed: false
      })
    })
  })

  describe('processBounce', () => {
    it('should process hard bounce correctly', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'bounce_events' || table === 'email_events') {
          return { insert: mockInsert, update: mockUpdate }
        }
        return { insert: mockInsert, select: jest.fn(), update: mockUpdate }
      })

      await emailTracker.processBounce(
        'msg_123',
        'test@example.com',
        'hard',
        'Mailbox does not exist',
        'provider_123',
        'permanent',
        '550 5.1.1 User unknown',
        'campaign_123',
        'contact_123'
      )

      // Verify bounce event was stored
      expect(mockInsert).toHaveBeenCalledWith({
        id: expect.stringMatching(/^event_/),
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        bounce_type: 'hard',
        bounce_sub_type: 'permanent',
        bounce_reason: 'Mailbox does not exist',
        diagnostic_code: '550 5.1.1 User unknown',
        timestamp: expect.any(String),
        provider_id: 'provider_123',
        processed: false,
        campaign_id: 'campaign_123',
        contact_id: 'contact_123'
      })

      // Verify email event was stored
      expect(mockInsert).toHaveBeenCalledWith({
        id: expect.stringMatching(/^event_/),
        message_id: 'msg_123',
        type: 'bounced',
        timestamp: expect.any(String),
        recipient_email: 'test@example.com',
        provider_id: 'provider_123',
        event_data: {
          bounceType: 'hard',
          bounceSubType: 'permanent',
          bounceReason: 'Mailbox does not exist',
          diagnosticCode: '550 5.1.1 User unknown'
        },
        campaign_id: 'campaign_123',
        contact_id: 'contact_123'
      })

      // Verify contact was marked as bounced for hard bounce
      expect(mockUpdate).toHaveBeenCalledWith({
        email_status: 'bounced',
        bounced_at: expect.any(String)
      })
    })

    it('should not update contact status for soft bounce', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'bounce_events' || table === 'email_events') {
          return { insert: mockInsert, update: mockUpdate }
        }
        if (table === 'contacts') {
          return { update: mockUpdate }
        }
        return { insert: mockInsert, select: jest.fn(), update: mockUpdate }
      })

      await emailTracker.processBounce(
        'msg_123',
        'test@example.com',
        'soft',
        'Mailbox full',
        'provider_123'
      )

      // Verify contact status was not updated for soft bounce
      const contactUpdateCalls = mockUpdate.mock.calls.filter(call => 
        call[0] && call[0].email_status === 'bounced'
      )
      expect(contactUpdateCalls).toHaveLength(0)
    })
  })

  describe('getEmailAnalytics', () => {
    it('should return complete email analytics', async () => {
      const mockSendRecord = {
        message_id: 'msg_123',
        recipient_email: 'test@example.com',
        campaign_id: 'campaign_123',
        contact_id: 'contact_123',
        success: true,
        created_at: '2024-01-01T10:00:00Z',
        delivered_at: '2024-01-01T10:01:00Z'
      }

      const mockEvents = [
        {
          type: 'delivered',
          timestamp: '2024-01-01T10:01:00Z'
        },
        {
          type: 'opened',
          timestamp: '2024-01-01T10:05:00Z'
        },
        {
          type: 'clicked',
          timestamp: '2024-01-01T10:10:00Z'
        }
      ]

      const mockPixel = {
        opened: true,
        opened_at: '2024-01-01T10:05:00Z',
        open_count: 2
      }

      const mockClicks = [
        {
          clicked: true,
          clicked_at: '2024-01-01T10:10:00Z',
          click_count: 1
        }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_sends') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSendRecord, error: null })
              })
            })
          }
        }
        if (table === 'email_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockEvents, error: null })
              })
            })
          }
        }
        if (table === 'tracking_pixels') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockPixel, error: null })
              })
            })
          }
        }
        if (table === 'click_tracking') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockClicks, error: null })
            })
          }
        }
        return { select: jest.fn() }
      })

      const result = await emailTracker.getEmailAnalytics('msg_123')

      expect(result).toEqual({
        messageId: 'msg_123',
        recipientEmail: 'test@example.com',
        campaignId: 'campaign_123',
        contactId: 'contact_123',
        sent: true,
        sentAt: '2024-01-01T10:00:00Z',
        delivered: true,
        deliveredAt: '2024-01-01T10:01:00Z',
        opened: true,
        openedAt: '2024-01-01T10:05:00Z',
        openCount: 2,
        clicked: true,
        clickedAt: '2024-01-01T10:10:00Z',
        clickCount: 1,
        bounced: false,
        complained: false,
        unsubscribed: false,
        replied: false
      })
    })

    it('should return null for non-existent message', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
          })
        })
      })

      const result = await emailTracker.getEmailAnalytics('invalid_msg')

      expect(result).toBeNull()
    })
  })

  describe('cleanContactList', () => {
    it('should clean bounced and unsubscribed contacts', async () => {
      const mockContacts = [
        { id: '1', email: 'bounced@example.com', email_status: 'bounced' },
        { id: '2', email: 'unsubscribed@example.com', email_status: 'unsubscribed' },
        { id: '3', email: 'complained@example.com', email_status: 'complained' },
        { id: '4', email: 'active@example.com', email_status: 'active' }
      ]

      const mockSelect = jest.fn().mockResolvedValue({ data: mockContacts, error: null })
      const mockUpdate = jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        update: mockUpdate
      })

      const result = await emailTracker.cleanContactList()

      expect(result).toEqual({
        cleaned: 3,
        bounced: 1,
        unsubscribed: 1,
        complained: 1
      })

      // Verify contacts were marked as inactive
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false })
    })

    it('should handle empty contact list', async () => {
      const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await emailTracker.cleanContactList()

      expect(result).toEqual({
        cleaned: 0,
        bounced: 0,
        unsubscribed: 0,
        complained: 0
      })
    })
  })
})