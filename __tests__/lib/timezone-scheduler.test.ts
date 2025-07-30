import { TimezoneScheduler, TimezoneUtils, SchedulingContext, ScheduleSettings } from '../../lib/timezone-scheduler'

describe('TimezoneScheduler', () => {
  let scheduler: TimezoneScheduler

  beforeEach(() => {
    scheduler = new TimezoneScheduler()
    scheduler.clearCaches()
  })

  describe('calculateOptimalScheduleTime', () => {
    const baseContext: SchedulingContext = {
      contact: {
        id: 'contact-1',
        email: 'test@example.com'
      },
      campaign_settings: {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5], // Monday to Friday
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: false,
        holiday_list: [],
        optimal_send_times: []
      },
      current_time: new Date('2024-01-15T10:00:00Z'), // Monday
      priority: 'normal'
    }

    it('should schedule within business hours', async () => {
      const result = await scheduler.calculateOptimalScheduleTime(baseContext)
      
      expect(result.scheduled_at).toBeDefined()
      expect(result.confidence_score).toBeGreaterThan(0)
      expect(result.reasoning).toContain('Using timezone: UTC')
    })

    it('should apply step delay', async () => {
      const contextWithDelay = {
        ...baseContext,
        step_delay_hours: 24
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithDelay)
      
      expect(result.reasoning).toContain('Applied 24h step delay')
      expect(result.scheduled_at.getTime()).toBeGreaterThan(baseContext.current_time.getTime())
    })

    it('should detect timezone from contact country', async () => {
      const contextWithCountry = {
        ...baseContext,
        contact: {
          ...baseContext.contact,
          country: 'GB'
        }
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithCountry)
      
      expect(result.timezone_used).toBe('Europe/London')
    })

    it('should detect timezone from email domain', async () => {
      const contextWithDomain = {
        ...baseContext,
        contact: {
          ...baseContext.contact,
          email: 'test@company.co.uk'
        }
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithDomain)
      
      expect(result.timezone_used).toBe('Europe/London')
    })

    it('should adjust for business hours when outside', async () => {
      const contextOutsideHours = {
        ...baseContext,
        current_time: new Date('2024-01-15T20:00:00Z') // 8 PM UTC
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextOutsideHours)
      
      expect(result.adjustments_made.length).toBeGreaterThan(0)
      expect(result.adjustments_made.some(adj => adj.includes('business'))).toBe(true)
    })

    it('should avoid weekends', async () => {
      const contextWeekend = {
        ...baseContext,
        current_time: new Date('2024-01-13T10:00:00Z') // Saturday
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWeekend)
      
      expect(result.adjustments_made.some(adj => adj.includes('Monday'))).toBe(true)
    })

    it('should avoid holidays', async () => {
      const contextWithHolidays = {
        ...baseContext,
        campaign_settings: {
          ...baseContext.campaign_settings,
          avoid_holidays: true,
          holiday_list: ['2024-01-15'] // Current day is holiday
        }
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithHolidays)
      
      expect(result.adjustments_made.some(adj => adj.includes('holiday'))).toBe(true)
    })

    it('should use custom time windows', async () => {
      const contextWithTimeWindows = {
        ...baseContext,
        campaign_settings: {
          ...baseContext.campaign_settings,
          custom_time_windows: [{
            id: 'window-1',
            name: 'Morning Window',
            start_time: '08:00',
            end_time: '10:00',
            days_of_week: [1, 2, 3, 4, 5],
            timezone: 'UTC'
          }]
        },
        current_time: new Date('2024-01-15T11:00:00Z') // Outside window
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithTimeWindows)
      
      expect(result.adjustments_made.some(adj => adj.includes('time window'))).toBe(true)
    })

    it('should use optimal send times when configured', async () => {
      const contextWithOptimalTimes = {
        ...baseContext,
        campaign_settings: {
          ...baseContext.campaign_settings,
          optimal_send_times: [{
            day_of_week: 2, // Tuesday
            hour: 10,
            minute: 30,
            effectiveness_score: 85,
            timezone: 'UTC'
          }]
        }
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextWithOptimalTimes)
      
      expect(result.reasoning.some(reason => reason.includes('optimal'))).toBe(true)
    })

    it('should handle high priority emails', async () => {
      const contextHighPriority = {
        ...baseContext,
        priority: 'high' as const
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextHighPriority)
      
      expect(result.reasoning).toContain('High priority - relaxed constraints')
    })

    it('should handle low priority emails', async () => {
      const contextLowPriority = {
        ...baseContext,
        priority: 'low' as const,
        current_time: new Date('2024-01-15T10:00:00Z') // Peak hours
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextLowPriority)
      
      expect(result.adjustments_made.some(adj => adj.includes('Low priority'))).toBe(true)
    })

    it('should cap scheduling at 7 days maximum', async () => {
      const contextFarFuture = {
        ...baseContext,
        step_delay_hours: 24 * 10 // 10 days
      }

      const result = await scheduler.calculateOptimalScheduleTime(contextFarFuture)
      
      const maxTime = new Date(baseContext.current_time.getTime() + 7 * 24 * 60 * 60 * 1000)
      expect(result.scheduled_at.getTime()).toBeLessThanOrEqual(maxTime.getTime())
      expect(result.adjustments_made).toContain('Capped at maximum 7 days in future')
    })

    it('should handle errors gracefully with fallback', async () => {
      const invalidContext = {
        ...baseContext,
        campaign_settings: {
          ...baseContext.campaign_settings,
          business_hours_start: 'invalid-time'
        }
      }

      const result = await scheduler.calculateOptimalScheduleTime(invalidContext)
      
      expect(result.fallback_used).toBe(true)
      expect(result.confidence_score).toBeLessThan(50)
      expect(result.reasoning).toContain('Fallback scheduling due to error')
    })
  })

  describe('batchScheduleEmails', () => {
    it('should process multiple contexts in batches', async () => {
      const contexts: SchedulingContext[] = Array.from({ length: 75 }, (_, i) => ({
        contact: {
          id: `contact-${i}`,
          email: `test${i}@example.com`
        },
        campaign_settings: {
          timezone_detection: true,
          business_hours_only: false,
          business_hours_start: '09:00',
          business_hours_end: '17:00',
          business_days: [1, 2, 3, 4, 5],
          custom_time_windows: [],
          avoid_weekends: false,
          avoid_holidays: false,
          holiday_list: [],
          optimal_send_times: []
        },
        current_time: new Date('2024-01-15T10:00:00Z'),
        priority: 'normal'
      }))

      const results = await scheduler.batchScheduleEmails(contexts)
      
      expect(results).toHaveLength(75)
      expect(results.every(result => result.scheduled_at instanceof Date)).toBe(true)
    })
  })

  describe('getTimezoneSuggestions', () => {
    it('should suggest timezone from contact data', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@company.co.uk',
        country: 'GB',
        timezone: 'Europe/London',
        company_domain: 'company.co.uk'
      }

      const suggestions = await scheduler.getTimezoneSuggestions(contact)
      
      expect(suggestions).toContain('Europe/London')
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should handle contact with minimal data', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@example.com'
      }

      const suggestions = await scheduler.getTimezoneSuggestions(contact)
      
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })

  describe('validateScheduleSettings', () => {
    it('should validate correct settings', () => {
      const validSettings: ScheduleSettings = {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: false,
        holiday_list: [],
        optimal_send_times: []
      }

      const result = scheduler.validateScheduleSettings(validSettings)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid time format', () => {
      const invalidSettings = {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '25:00', // Invalid hour
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: false,
        holiday_list: [],
        optimal_send_times: []
      }

      const result = scheduler.validateScheduleSettings(invalidSettings)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject invalid business days', () => {
      const invalidSettings = {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5, 8], // Invalid day
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: false,
        holiday_list: [],
        optimal_send_times: []
      }

      const result = scheduler.validateScheduleSettings(invalidSettings)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

describe('TimezoneUtils', () => {
  describe('convertTime', () => {
    it('should convert time between timezones', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const converted = TimezoneUtils.convertTime(date, 'UTC', 'America/New_York')
      
      expect(converted).toBeInstanceOf(Date)
      expect(converted.getTime()).not.toBe(date.getTime())
    })

    it('should handle same timezone conversion', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const converted = TimezoneUtils.convertTime(date, 'UTC', 'UTC')
      
      expect(converted.getTime()).toBe(date.getTime())
    })

    it('should handle invalid timezone gracefully', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const converted = TimezoneUtils.convertTime(date, 'UTC', 'Invalid/Timezone')
      
      expect(converted).toBeInstanceOf(Date)
    })
  })

  describe('getCurrentTimeInTimezone', () => {
    it('should return current time in specified timezone', () => {
      const time = TimezoneUtils.getCurrentTimeInTimezone('UTC')
      
      expect(time).toBeInstanceOf(Date)
      expect(Math.abs(time.getTime() - Date.now())).toBeLessThan(1000) // Within 1 second
    })
  })

  describe('isWithinBusinessHours', () => {
    it('should return true for time within business hours', () => {
      const time = new Date('2024-01-15T10:00:00Z') // Monday 10 AM
      const result = TimezoneUtils.isWithinBusinessHours(
        time,
        '09:00',
        '17:00',
        [1, 2, 3, 4, 5]
      )
      
      expect(result).toBe(true)
    })

    it('should return false for time outside business hours', () => {
      const time = new Date('2024-01-15T20:00:00Z') // Monday 8 PM
      const result = TimezoneUtils.isWithinBusinessHours(
        time,
        '09:00',
        '17:00',
        [1, 2, 3, 4, 5]
      )
      
      expect(result).toBe(false)
    })

    it('should return false for weekend', () => {
      const time = new Date('2024-01-13T10:00:00Z') // Saturday 10 AM
      const result = TimezoneUtils.isWithinBusinessHours(
        time,
        '09:00',
        '17:00',
        [1, 2, 3, 4, 5]
      )
      
      expect(result).toBe(false)
    })

    it('should handle edge cases at business hour boundaries', () => {
      const startTime = new Date('2024-01-15T09:00:00Z') // Exactly 9 AM
      const endTime = new Date('2024-01-15T17:00:00Z') // Exactly 5 PM
      
      expect(TimezoneUtils.isWithinBusinessHours(
        startTime,
        '09:00',
        '17:00',
        [1, 2, 3, 4, 5]
      )).toBe(true)
      
      expect(TimezoneUtils.isWithinBusinessHours(
        endTime,
        '09:00',
        '17:00',
        [1, 2, 3, 4, 5]
      )).toBe(false) // End time is exclusive
    })
  })

  describe('formatTimeInTimezone', () => {
    it('should format time in specified timezone', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const formatted = TimezoneUtils.formatTimeInTimezone(date, 'UTC')
      
      expect(typeof formatted).toBe('string')
      expect(formatted).toContain('2024')
      expect(formatted).toContain('Jan')
    })

    it('should handle invalid timezone gracefully', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const formatted = TimezoneUtils.formatTimeInTimezone(date, 'Invalid/Timezone')
      
      expect(typeof formatted).toBe('string')
      expect(formatted).toContain('2024-01-15T12:00:00.000Z')
    })

    it('should use custom locale', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const formatted = TimezoneUtils.formatTimeInTimezone(date, 'UTC', 'de-DE')
      
      expect(typeof formatted).toBe('string')
    })
  })
})

describe('Integration Tests', () => {
  let scheduler: TimezoneScheduler

  beforeEach(() => {
    scheduler = new TimezoneScheduler()
  })

  it('should handle complex scheduling scenario', async () => {
    const context: SchedulingContext = {
      contact: {
        id: 'contact-1',
        email: 'test@company.co.uk',
        country: 'GB',
        company_domain: 'company.co.uk'
      },
      campaign_settings: {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [{
          id: 'morning',
          name: 'Morning Window',
          start_time: '10:00',
          end_time: '12:00',
          days_of_week: [1, 2, 3, 4, 5],
          timezone: 'Europe/London'
        }],
        avoid_weekends: true,
        avoid_holidays: true,
        holiday_list: ['2024-01-16'], // Tuesday
        optimal_send_times: [{
          day_of_week: 3, // Wednesday
          hour: 11,
          minute: 0,
          effectiveness_score: 90,
          timezone: 'Europe/London'
        }]
      },
      current_time: new Date('2024-01-15T08:00:00Z'), // Monday 8 AM UTC
      step_delay_hours: 2,
      priority: 'normal'
    }

    const result = await scheduler.calculateOptimalScheduleTime(context)
    
    expect(result.scheduled_at).toBeInstanceOf(Date)
    expect(result.timezone_used).toBe('Europe/London')
    expect(result.confidence_score).toBeGreaterThan(0)
    expect(result.reasoning.length).toBeGreaterThan(0)
    
    // Should avoid the holiday on Tuesday and schedule for Wednesday
    const scheduledDay = result.scheduled_at.getDay()
    expect(scheduledDay).toBe(3) // Wednesday
  })

  it('should handle multiple contacts with different timezones', async () => {
    const contexts: SchedulingContext[] = [
      {
        contact: { id: '1', email: 'us@company.com', country: 'US' },
        campaign_settings: {
          timezone_detection: true,
          business_hours_only: true,
          business_hours_start: '09:00',
          business_hours_end: '17:00',
          business_days: [1, 2, 3, 4, 5],
          custom_time_windows: [],
          avoid_weekends: true,
          avoid_holidays: false,
          holiday_list: [],
          optimal_send_times: []
        },
        current_time: new Date('2024-01-15T10:00:00Z'),
        priority: 'normal'
      },
      {
        contact: { id: '2', email: 'uk@company.co.uk', country: 'GB' },
        campaign_settings: {
          timezone_detection: true,
          business_hours_only: true,
          business_hours_start: '09:00',
          business_hours_end: '17:00',
          business_days: [1, 2, 3, 4, 5],
          custom_time_windows: [],
          avoid_weekends: true,
          avoid_holidays: false,
          holiday_list: [],
          optimal_send_times: []
        },
        current_time: new Date('2024-01-15T10:00:00Z'),
        priority: 'normal'
      },
      {
        contact: { id: '3', email: 'jp@company.jp', country: 'JP' },
        campaign_settings: {
          timezone_detection: true,
          business_hours_only: true,
          business_hours_start: '09:00',
          business_hours_end: '17:00',
          business_days: [1, 2, 3, 4, 5],
          custom_time_windows: [],
          avoid_weekends: true,
          avoid_holidays: false,
          holiday_list: [],
          optimal_send_times: []
        },
        current_time: new Date('2024-01-15T10:00:00Z'),
        priority: 'normal'
      }
    ]

    const results = await scheduler.batchScheduleEmails(contexts)
    
    expect(results).toHaveLength(3)
    expect(results[0].timezone_used).toBe('America/New_York')
    expect(results[1].timezone_used).toBe('Europe/London')
    expect(results[2].timezone_used).toBe('Asia/Tokyo')
    
    // All should have reasonable confidence scores
    expect(results.every(r => r.confidence_score > 50)).toBe(true)
  })
})