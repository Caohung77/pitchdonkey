import { z } from 'zod'

// Timezone and scheduling interfaces
export interface TimeWindow {
  id: string
  name: string
  start_time: string // HH:MM format
  end_time: string // HH:MM format
  days_of_week: number[] // 0-6, Sunday = 0
  timezone: string
}

export interface ScheduleSettings {
  timezone_detection: boolean
  business_hours_only: boolean
  business_hours_start: string // HH:MM
  business_hours_end: string // HH:MM
  business_days: number[] // 0-6, Sunday = 0
  custom_time_windows: TimeWindow[]
  avoid_weekends: boolean
  avoid_holidays: boolean
  holiday_list: string[] // YYYY-MM-DD format
  optimal_send_times: OptimalSendTime[]
  recipient_timezone_override?: string
}

export interface OptimalSendTime {
  day_of_week: number
  hour: number
  minute: number
  effectiveness_score: number // 0-100
  timezone: string
}

export interface TimezoneInfo {
  timezone: string
  offset: number // UTC offset in minutes
  is_dst: boolean
  country_code?: string
  region?: string
}

export interface SchedulingContext {
  contact: {
    id: string
    email: string
    timezone?: string
    country?: string
    company_domain?: string
    last_activity_timezone?: string
  }
  campaign_settings: ScheduleSettings
  current_time: Date
  step_delay_hours?: number
  priority: 'low' | 'normal' | 'high'
}

export interface ScheduleResult {
  scheduled_at: Date
  timezone_used: string
  reasoning: string[]
  adjustments_made: string[]
  confidence_score: number // 0-100
  fallback_used: boolean
}

// Validation schemas
const timeWindowSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  days_of_week: z.array(z.number().min(0).max(6)),
  timezone: z.string()
})

const scheduleSettingsSchema = z.object({
  timezone_detection: z.boolean(),
  business_hours_only: z.boolean(),
  business_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  business_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  business_days: z.array(z.number().min(0).max(6)),
  custom_time_windows: z.array(timeWindowSchema),
  avoid_weekends: z.boolean(),
  avoid_holidays: z.boolean(),
  holiday_list: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  optimal_send_times: z.array(z.object({
    day_of_week: z.number().min(0).max(6),
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59),
    effectiveness_score: z.number().min(0).max(100),
    timezone: z.string()
  })),
  recipient_timezone_override: z.string().optional()
})

/**
 * Timezone-aware scheduling engine
 */
export class TimezoneScheduler {
  private timezoneCache: Map<string, TimezoneInfo> = new Map()
  private holidayCache: Map<string, Set<string>> = new Map()
  
  // Common timezone mappings for fallback
  private readonly TIMEZONE_MAPPINGS = {
    'US': 'America/New_York',
    'CA': 'America/Toronto', 
    'GB': 'Europe/London',
    'DE': 'Europe/Berlin',
    'FR': 'Europe/Paris',
    'AU': 'Australia/Sydney',
    'JP': 'Asia/Tokyo',
    'IN': 'Asia/Kolkata',
    'BR': 'America/Sao_Paulo',
    'MX': 'America/Mexico_City'
  }

  // Optimal send times by industry (default patterns)
  private readonly OPTIMAL_SEND_PATTERNS = {
    'B2B': [
      { day_of_week: 2, hour: 10, minute: 0, effectiveness_score: 85 }, // Tuesday 10 AM
      { day_of_week: 3, hour: 14, minute: 0, effectiveness_score: 80 }, // Wednesday 2 PM
      { day_of_week: 4, hour: 11, minute: 0, effectiveness_score: 82 }, // Thursday 11 AM
    ],
    'SaaS': [
      { day_of_week: 2, hour: 9, minute: 30, effectiveness_score: 88 }, // Tuesday 9:30 AM
      { day_of_week: 3, hour: 15, minute: 0, effectiveness_score: 83 }, // Wednesday 3 PM
      { day_of_week: 4, hour: 10, minute: 30, effectiveness_score: 85 }, // Thursday 10:30 AM
    ],
    'E-commerce': [
      { day_of_week: 1, hour: 11, minute: 0, effectiveness_score: 75 }, // Monday 11 AM
      { day_of_week: 2, hour: 14, minute: 30, effectiveness_score: 78 }, // Tuesday 2:30 PM
      { day_of_week: 4, hour: 16, minute: 0, effectiveness_score: 72 }, // Thursday 4 PM
    ]
  }

  constructor(private supabase?: any) {}

  /**
   * Calculate optimal schedule time for an email
   */
  async calculateOptimalScheduleTime(context: SchedulingContext): Promise<ScheduleResult> {
    try {
      // Validate input
      const validatedSettings = scheduleSettingsSchema.parse(context.campaign_settings)
      
      let scheduledTime = new Date(context.current_time)
      const reasoning: string[] = []
      const adjustments: string[] = []
      let confidenceScore = 100
      let fallbackUsed = false

      // Apply step delay if specified
      if (context.step_delay_hours) {
        scheduledTime = new Date(scheduledTime.getTime() + context.step_delay_hours * 60 * 60 * 1000)
        reasoning.push(`Applied ${context.step_delay_hours}h step delay`)
      }

      // Detect recipient timezone
      const recipientTimezone = await this.detectRecipientTimezone(context.contact, validatedSettings)
      reasoning.push(`Using timezone: ${recipientTimezone.timezone}`)

      // Convert to recipient timezone
      const recipientTime = this.convertToTimezone(scheduledTime, recipientTimezone.timezone)

      // Apply optimal send time if available
      const optimalTime = this.findOptimalSendTime(recipientTime, validatedSettings, recipientTimezone.timezone)
      if (optimalTime) {
        scheduledTime = optimalTime.scheduledTime
        reasoning.push(`Applied optimal send time: ${optimalTime.reasoning}`)
        confidenceScore = Math.max(confidenceScore - 10, optimalTime.confidence)
      }

      // Apply business hours constraints
      if (validatedSettings.business_hours_only) {
        const businessHoursResult = this.adjustForBusinessHours(
          scheduledTime, 
          validatedSettings, 
          recipientTimezone.timezone
        )
        scheduledTime = businessHoursResult.adjustedTime
        if (businessHoursResult.wasAdjusted) {
          adjustments.push(businessHoursResult.reason)
          confidenceScore = Math.max(confidenceScore - 5, 70)
        }
      }

      // Apply custom time windows
      if (validatedSettings.custom_time_windows.length > 0) {
        const timeWindowResult = this.adjustForTimeWindows(
          scheduledTime,
          validatedSettings.custom_time_windows,
          recipientTimezone.timezone
        )
        scheduledTime = timeWindowResult.adjustedTime
        if (timeWindowResult.wasAdjusted) {
          adjustments.push(timeWindowResult.reason)
          confidenceScore = Math.max(confidenceScore - 5, 70)
        }
      }

      // Avoid weekends
      if (validatedSettings.avoid_weekends) {
        const weekendResult = this.adjustForWeekends(scheduledTime, recipientTimezone.timezone)
        scheduledTime = weekendResult.adjustedTime
        if (weekendResult.wasAdjusted) {
          adjustments.push(weekendResult.reason)
          confidenceScore = Math.max(confidenceScore - 3, 75)
        }
      }

      // Avoid holidays
      if (validatedSettings.avoid_holidays && validatedSettings.holiday_list.length > 0) {
        const holidayResult = await this.adjustForHolidays(
          scheduledTime,
          validatedSettings.holiday_list,
          recipientTimezone.timezone
        )
        scheduledTime = holidayResult.adjustedTime
        if (holidayResult.wasAdjusted) {
          adjustments.push(holidayResult.reason)
          confidenceScore = Math.max(confidenceScore - 5, 70)
        }
      }

      // Apply priority adjustments
      if (context.priority === 'high') {
        // High priority emails can be sent slightly outside optimal windows
        confidenceScore = Math.min(confidenceScore + 5, 100)
        reasoning.push('High priority - relaxed constraints')
      } else if (context.priority === 'low') {
        // Low priority emails should wait for optimal times
        const delayResult = this.addLowPriorityDelay(scheduledTime, recipientTimezone.timezone)
        scheduledTime = delayResult.adjustedTime
        if (delayResult.wasAdjusted) {
          adjustments.push(delayResult.reason)
        }
      }

      // Final validation - ensure we're not scheduling too far in the future
      const maxFutureTime = new Date(context.current_time.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      if (scheduledTime > maxFutureTime) {
        scheduledTime = maxFutureTime
        adjustments.push('Capped at maximum 7 days in future')
        fallbackUsed = true
        confidenceScore = Math.max(confidenceScore - 20, 50)
      }

      return {
        scheduled_at: scheduledTime,
        timezone_used: recipientTimezone.timezone,
        reasoning,
        adjustments_made: adjustments,
        confidence_score: confidenceScore,
        fallback_used
      }

    } catch (error) {
      console.error('Error calculating optimal schedule time:', error)
      
      // Fallback to simple scheduling
      const fallbackTime = new Date(context.current_time.getTime() + (context.step_delay_hours || 1) * 60 * 60 * 1000)
      
      return {
        scheduled_at: fallbackTime,
        timezone_used: 'UTC',
        reasoning: ['Fallback scheduling due to error'],
        adjustments_made: [`Error occurred: ${error.message}`],
        confidence_score: 30,
        fallback_used: true
      }
    }
  }

  /**
   * Detect recipient timezone from various signals
   */
  private async detectRecipientTimezone(
    contact: SchedulingContext['contact'], 
    settings: ScheduleSettings
  ): Promise<TimezoneInfo> {
    // Use override if specified
    if (settings.recipient_timezone_override) {
      return this.getTimezoneInfo(settings.recipient_timezone_override)
    }

    // Use contact's explicit timezone if available
    if (contact.timezone) {
      return this.getTimezoneInfo(contact.timezone)
    }

    // Try to detect from last activity timezone
    if (contact.last_activity_timezone) {
      return this.getTimezoneInfo(contact.last_activity_timezone)
    }

    // Try to detect from country
    if (contact.country) {
      const timezone = this.TIMEZONE_MAPPINGS[contact.country.toUpperCase()]
      if (timezone) {
        return this.getTimezoneInfo(timezone)
      }
    }

    // Try to detect from company domain
    if (contact.company_domain) {
      const detectedTimezone = await this.detectTimezoneFromDomain(contact.company_domain)
      if (detectedTimezone) {
        return this.getTimezoneInfo(detectedTimezone)
      }
    }

    // Try to detect from email domain
    if (contact.email) {
      const domain = contact.email.split('@')[1]
      const detectedTimezone = await this.detectTimezoneFromDomain(domain)
      if (detectedTimezone) {
        return this.getTimezoneInfo(detectedTimezone)
      }
    }

    // Fallback to UTC
    return this.getTimezoneInfo('UTC')
  }

  /**
   * Detect timezone from domain using various heuristics
   */
  private async detectTimezoneFromDomain(domain: string): Promise<string | null> {
    try {
      // Check cache first
      const cacheKey = `domain:${domain}`
      if (this.timezoneCache.has(cacheKey)) {
        return this.timezoneCache.get(cacheKey)?.timezone || null
      }

      // Common domain patterns
      const domainPatterns = {
        '.co.uk': 'Europe/London',
        '.uk': 'Europe/London',
        '.de': 'Europe/Berlin',
        '.fr': 'Europe/Paris',
        '.it': 'Europe/Rome',
        '.es': 'Europe/Madrid',
        '.nl': 'Europe/Amsterdam',
        '.au': 'Australia/Sydney',
        '.ca': 'America/Toronto',
        '.jp': 'Asia/Tokyo',
        '.in': 'Asia/Kolkata',
        '.br': 'America/Sao_Paulo',
        '.mx': 'America/Mexico_City'
      }

      for (const [pattern, timezone] of Object.entries(domainPatterns)) {
        if (domain.endsWith(pattern)) {
          const timezoneInfo = this.getTimezoneInfo(timezone)
          this.timezoneCache.set(cacheKey, timezoneInfo)
          return timezone
        }
      }

      // TODO: Implement more sophisticated domain-to-timezone detection
      // This could include:
      // - GeoIP lookup for domain
      // - WHOIS data analysis
      // - Company database lookup

      return null

    } catch (error) {
      console.error('Error detecting timezone from domain:', error)
      return null
    }
  }

  /**
   * Get timezone information
   */
  private getTimezoneInfo(timezone: string): TimezoneInfo {
    const cacheKey = `tz:${timezone}`
    
    if (this.timezoneCache.has(cacheKey)) {
      return this.timezoneCache.get(cacheKey)!
    }

    try {
      const now = new Date()
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
      const targetTime = new Date(utcTime + this.getTimezoneOffset(timezone) * 60000)
      
      const timezoneInfo: TimezoneInfo = {
        timezone,
        offset: this.getTimezoneOffset(timezone),
        is_dst: this.isDaylightSavingTime(timezone, now),
        country_code: this.getCountryFromTimezone(timezone),
        region: this.getRegionFromTimezone(timezone)
      }

      this.timezoneCache.set(cacheKey, timezoneInfo)
      return timezoneInfo

    } catch (error) {
      console.error(`Error getting timezone info for ${timezone}:`, error)
      
      // Fallback to UTC
      const fallbackInfo: TimezoneInfo = {
        timezone: 'UTC',
        offset: 0,
        is_dst: false
      }
      
      this.timezoneCache.set(cacheKey, fallbackInfo)
      return fallbackInfo
    }
  }

  /**
   * Convert time to specific timezone
   */
  private convertToTimezone(date: Date, timezone: string): Date {
    try {
      // Use Intl.DateTimeFormat for accurate timezone conversion
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000)
      const offset = this.getTimezoneOffset(timezone)
      return new Date(utcTime + (offset * 60000))
    } catch (error) {
      console.error('Error converting timezone:', error)
      return date
    }
  }

  /**
   * Find optimal send time based on patterns and settings
   */
  private findOptimalSendTime(
    currentTime: Date,
    settings: ScheduleSettings,
    timezone: string
  ): { scheduledTime: Date; reasoning: string; confidence: number } | null {
    try {
      // Use custom optimal send times if configured
      if (settings.optimal_send_times.length > 0) {
        const applicableTimes = settings.optimal_send_times.filter(
          time => time.timezone === timezone || time.timezone === 'UTC'
        )

        if (applicableTimes.length > 0) {
          // Find the next optimal time
          const nextOptimalTime = this.findNextOptimalTime(currentTime, applicableTimes)
          if (nextOptimalTime) {
            return {
              scheduledTime: nextOptimalTime.time,
              reasoning: `Next optimal time (${nextOptimalTime.effectiveness}% effective)`,
              confidence: nextOptimalTime.effectiveness
            }
          }
        }
      }

      // Use default B2B patterns as fallback
      const defaultPattern = this.OPTIMAL_SEND_PATTERNS['B2B']
      const nextOptimalTime = this.findNextOptimalTime(currentTime, defaultPattern.map(p => ({
        ...p,
        timezone
      })))

      if (nextOptimalTime) {
        return {
          scheduledTime: nextOptimalTime.time,
          reasoning: `Default B2B optimal time (${nextOptimalTime.effectiveness}% effective)`,
          confidence: nextOptimalTime.effectiveness
        }
      }

      return null

    } catch (error) {
      console.error('Error finding optimal send time:', error)
      return null
    }
  }

  /**
   * Find next optimal time from patterns
   */
  private findNextOptimalTime(
    currentTime: Date,
    patterns: OptimalSendTime[]
  ): { time: Date; effectiveness: number } | null {
    const sortedPatterns = patterns.sort((a, b) => b.effectiveness_score - a.effectiveness_score)
    
    for (const pattern of sortedPatterns) {
      const nextTime = this.getNextTimeForPattern(currentTime, pattern)
      
      // Don't schedule more than 7 days in advance
      const maxTime = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000)
      if (nextTime <= maxTime) {
        return {
          time: nextTime,
          effectiveness: pattern.effectiveness_score
        }
      }
    }

    return null
  }

  /**
   * Get next time matching a specific pattern
   */
  private getNextTimeForPattern(currentTime: Date, pattern: OptimalSendTime): Date {
    const result = new Date(currentTime)
    
    // Find next occurrence of the target day
    const currentDay = result.getDay()
    const targetDay = pattern.day_of_week
    
    let daysToAdd = targetDay - currentDay
    if (daysToAdd <= 0) {
      daysToAdd += 7 // Next week
    }
    
    result.setDate(result.getDate() + daysToAdd)
    result.setHours(pattern.hour, pattern.minute, 0, 0)
    
    // If the time has already passed today and it's the same day, move to next week
    if (daysToAdd === 0 && result <= currentTime) {
      result.setDate(result.getDate() + 7)
    }
    
    return result
  }

  /**
   * Adjust time for business hours
   */
  private adjustForBusinessHours(
    time: Date,
    settings: ScheduleSettings,
    timezone: string
  ): { adjustedTime: Date; wasAdjusted: boolean; reason: string } {
    const adjustedTime = new Date(time)
    const dayOfWeek = adjustedTime.getDay()
    
    // Check if it's a business day
    if (!settings.business_days.includes(dayOfWeek)) {
      // Move to next business day
      while (!settings.business_days.includes(adjustedTime.getDay())) {
        adjustedTime.setDate(adjustedTime.getDate() + 1)
      }
      
      // Set to start of business hours
      const [startHour, startMinute] = settings.business_hours_start.split(':').map(Number)
      adjustedTime.setHours(startHour, startMinute, 0, 0)
      
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: `Moved to next business day (${this.getDayName(adjustedTime.getDay())})`
      }
    }

    // Check if it's within business hours
    const [startHour, startMinute] = settings.business_hours_start.split(':').map(Number)
    const [endHour, endMinute] = settings.business_hours_end.split(':').map(Number)
    
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute
    const currentTime = adjustedTime.getHours() * 60 + adjustedTime.getMinutes()

    if (currentTime < startTime) {
      // Too early, move to start of business hours
      adjustedTime.setHours(startHour, startMinute, 0, 0)
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: `Moved to business hours start (${settings.business_hours_start})`
      }
    } else if (currentTime >= endTime) {
      // Too late, move to next business day
      adjustedTime.setDate(adjustedTime.getDate() + 1)
      while (!settings.business_days.includes(adjustedTime.getDay())) {
        adjustedTime.setDate(adjustedTime.getDate() + 1)
      }
      adjustedTime.setHours(startHour, startMinute, 0, 0)
      
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: `Moved to next business day start (${this.getDayName(adjustedTime.getDay())} ${settings.business_hours_start})`
      }
    }

    return {
      adjustedTime,
      wasAdjusted: false,
      reason: 'Within business hours'
    }
  }

  /**
   * Adjust time for custom time windows
   */
  private adjustForTimeWindows(
    time: Date,
    timeWindows: TimeWindow[],
    timezone: string
  ): { adjustedTime: Date; wasAdjusted: boolean; reason: string } {
    const adjustedTime = new Date(time)
    
    // Find applicable time windows for current day
    const dayOfWeek = adjustedTime.getDay()
    const applicableWindows = timeWindows.filter(window => 
      window.days_of_week.includes(dayOfWeek) && 
      (window.timezone === timezone || window.timezone === 'UTC')
    )

    if (applicableWindows.length === 0) {
      // No applicable windows, find next available window
      const nextWindow = this.findNextTimeWindow(adjustedTime, timeWindows, timezone)
      if (nextWindow) {
        return {
          adjustedTime: nextWindow.time,
          wasAdjusted: true,
          reason: `Moved to next available time window: ${nextWindow.window.name}`
        }
      }
    } else {
      // Check if current time is within any window
      const currentMinutes = adjustedTime.getHours() * 60 + adjustedTime.getMinutes()
      
      for (const window of applicableWindows) {
        const [startHour, startMinute] = window.start_time.split(':').map(Number)
        const [endHour, endMinute] = window.end_time.split(':').map(Number)
        
        const startMinutes = startHour * 60 + startMinute
        const endMinutes = endHour * 60 + endMinute
        
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return {
            adjustedTime,
            wasAdjusted: false,
            reason: `Within time window: ${window.name}`
          }
        }
      }
      
      // Not in any window, move to next available window
      const nextWindow = this.findNextTimeWindow(adjustedTime, timeWindows, timezone)
      if (nextWindow) {
        return {
          adjustedTime: nextWindow.time,
          wasAdjusted: true,
          reason: `Moved to time window: ${nextWindow.window.name}`
        }
      }
    }

    return {
      adjustedTime,
      wasAdjusted: false,
      reason: 'No time window constraints'
    }
  }

  /**
   * Find next available time window
   */
  private findNextTimeWindow(
    currentTime: Date,
    timeWindows: TimeWindow[],
    timezone: string
  ): { time: Date; window: TimeWindow } | null {
    const applicableWindows = timeWindows.filter(window => 
      window.timezone === timezone || window.timezone === 'UTC'
    )

    let nextTime: Date | null = null
    let nextWindow: TimeWindow | null = null

    for (const window of applicableWindows) {
      for (const dayOfWeek of window.days_of_week) {
        const windowTime = this.getNextWindowTime(currentTime, window, dayOfWeek)
        
        if (!nextTime || windowTime < nextTime) {
          nextTime = windowTime
          nextWindow = window
        }
      }
    }

    return nextTime && nextWindow ? { time: nextTime, window: nextWindow } : null
  }

  /**
   * Get next time for a specific window and day
   */
  private getNextWindowTime(currentTime: Date, window: TimeWindow, dayOfWeek: number): Date {
    const result = new Date(currentTime)
    const currentDay = result.getDay()
    
    let daysToAdd = dayOfWeek - currentDay
    if (daysToAdd < 0) {
      daysToAdd += 7
    }
    
    result.setDate(result.getDate() + daysToAdd)
    
    const [startHour, startMinute] = window.start_time.split(':').map(Number)
    result.setHours(startHour, startMinute, 0, 0)
    
    // If it's today and the time has passed, move to next week
    if (daysToAdd === 0 && result <= currentTime) {
      result.setDate(result.getDate() + 7)
    }
    
    return result
  }

  /**
   * Adjust time to avoid weekends
   */
  private adjustForWeekends(
    time: Date,
    timezone: string
  ): { adjustedTime: Date; wasAdjusted: boolean; reason: string } {
    const adjustedTime = new Date(time)
    const dayOfWeek = adjustedTime.getDay()
    
    if (dayOfWeek === 0) { // Sunday
      adjustedTime.setDate(adjustedTime.getDate() + 1) // Move to Monday
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: 'Moved from Sunday to Monday'
      }
    } else if (dayOfWeek === 6) { // Saturday
      adjustedTime.setDate(adjustedTime.getDate() + 2) // Move to Monday
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: 'Moved from Saturday to Monday'
      }
    }
    
    return {
      adjustedTime,
      wasAdjusted: false,
      reason: 'Not a weekend'
    }
  }

  /**
   * Adjust time to avoid holidays
   */
  private async adjustForHolidays(
    time: Date,
    holidayList: string[],
    timezone: string
  ): Promise<{ adjustedTime: Date; wasAdjusted: boolean; reason: string }> {
    const adjustedTime = new Date(time)
    const dateString = adjustedTime.toISOString().split('T')[0]
    
    if (holidayList.includes(dateString)) {
      // Move to next non-holiday
      let attempts = 0
      while (holidayList.includes(adjustedTime.toISOString().split('T')[0]) && attempts < 30) {
        adjustedTime.setDate(adjustedTime.getDate() + 1)
        attempts++
      }
      
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: `Moved to avoid holiday (${dateString})`
      }
    }
    
    return {
      adjustedTime,
      wasAdjusted: false,
      reason: 'Not a holiday'
    }
  }

  /**
   * Add delay for low priority emails
   */
  private addLowPriorityDelay(
    time: Date,
    timezone: string
  ): { adjustedTime: Date; wasAdjusted: boolean; reason: string } {
    const adjustedTime = new Date(time)
    const hour = adjustedTime.getHours()
    
    // If it's peak hours (9-11 AM or 2-4 PM), delay to off-peak
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
      // Move to 5 PM same day or 8 AM next day
      if (hour < 17) {
        adjustedTime.setHours(17, 0, 0, 0) // 5 PM
      } else {
        adjustedTime.setDate(adjustedTime.getDate() + 1)
        adjustedTime.setHours(8, 0, 0, 0) // 8 AM next day
      }
      
      return {
        adjustedTime,
        wasAdjusted: true,
        reason: 'Low priority - moved to off-peak hours'
      }
    }
    
    return {
      adjustedTime,
      wasAdjusted: false,
      reason: 'Already in off-peak hours'
    }
  }

  // Helper methods
  private getTimezoneOffset(timezone: string): number {
    try {
      const now = new Date()
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
      const utcDate = new Date(utcTime)
      
      // Use Intl.DateTimeFormat to get the time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      const parts = formatter.formatToParts(utcDate)
      const targetTime = new Date(
        parseInt(parts.find(p => p.type === 'year')?.value || '0'),
        parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
        parseInt(parts.find(p => p.type === 'day')?.value || '1'),
        parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
        parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
        parseInt(parts.find(p => p.type === 'second')?.value || '0')
      )
      
      return (targetTime.getTime() - utcDate.getTime()) / 60000
    } catch (error) {
      console.error(`Error getting timezone offset for ${timezone}:`, error)
      return 0
    }
  }

  private isDaylightSavingTime(timezone: string, date: Date): boolean {
    try {
      const jan = new Date(date.getFullYear(), 0, 1)
      const jul = new Date(date.getFullYear(), 6, 1)
      
      const janOffset = this.getTimezoneOffset(timezone)
      const julOffset = this.getTimezoneOffset(timezone)
      const currentOffset = this.getTimezoneOffset(timezone)
      
      return currentOffset !== Math.max(janOffset, julOffset)
    } catch (error) {
      return false
    }
  }

  private getCountryFromTimezone(timezone: string): string | undefined {
    const countryMappings: Record<string, string> = {
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Toronto': 'CA',
      'Europe/London': 'GB',
      'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR',
      'Asia/Tokyo': 'JP',
      'Asia/Kolkata': 'IN',
      'Australia/Sydney': 'AU'
    }
    
    return countryMappings[timezone]
  }

  private getRegionFromTimezone(timezone: string): string | undefined {
    const parts = timezone.split('/')
    return parts.length > 1 ? parts[1].replace('_', ' ') : undefined
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayOfWeek] || 'Unknown'
  }

  /**
   * Batch schedule multiple emails
   */
  async batchScheduleEmails(contexts: SchedulingContext[]): Promise<ScheduleResult[]> {
    const results: ScheduleResult[] = []
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 50
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize)
      const batchPromises = batch.map(context => this.calculateOptimalScheduleTime(context))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Get timezone suggestions for a contact
   */
  async getTimezoneSuggestions(contact: SchedulingContext['contact']): Promise<string[]> {
    const suggestions: string[] = []
    
    // Add explicit timezone if available
    if (contact.timezone) {
      suggestions.push(contact.timezone)
    }
    
    // Add country-based suggestions
    if (contact.country) {
      const timezone = this.TIMEZONE_MAPPINGS[contact.country.toUpperCase()]
      if (timezone && !suggestions.includes(timezone)) {
        suggestions.push(timezone)
      }
    }
    
    // Add domain-based suggestions
    if (contact.company_domain) {
      const domainTimezone = await this.detectTimezoneFromDomain(contact.company_domain)
      if (domainTimezone && !suggestions.includes(domainTimezone)) {
        suggestions.push(domainTimezone)
      }
    }
    
    // Add email domain suggestions
    if (contact.email) {
      const domain = contact.email.split('@')[1]
      const emailTimezone = await this.detectTimezoneFromDomain(domain)
      if (emailTimezone && !suggestions.includes(emailTimezone)) {
        suggestions.push(emailTimezone)
      }
    }
    
    return suggestions
  }

  /**
   * Validate schedule settings
   */
  validateScheduleSettings(settings: any): { valid: boolean; errors: string[] } {
    try {
      scheduleSettingsSchema.parse(settings)
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        }
      }
      return {
        valid: false,
        errors: ['Invalid schedule settings format']
      }
    }
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.timezoneCache.clear()
    this.holidayCache.clear()
  }
}

// Export utility functions
export const TimezoneUtils = {
  /**
   * Convert time between timezones
   */
  convertTime(date: Date, fromTimezone: string, toTimezone: string): Date {
    try {
      if (fromTimezone === toTimezone) {
        return new Date(date)
      }
      
      // Use Intl.DateTimeFormat for accurate conversion
      const fromFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: fromTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      const toFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: toTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      // Get UTC time
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000)
      const utcDate = new Date(utcTime)
      
      // Format in target timezone
      const toParts = toFormatter.formatToParts(utcDate)
      const targetTime = new Date(
        parseInt(toParts.find(p => p.type === 'year')?.value || '0'),
        parseInt(toParts.find(p => p.type === 'month')?.value || '1') - 1,
        parseInt(toParts.find(p => p.type === 'day')?.value || '1'),
        parseInt(toParts.find(p => p.type === 'hour')?.value || '0'),
        parseInt(toParts.find(p => p.type === 'minute')?.value || '0'),
        parseInt(toParts.find(p => p.type === 'second')?.value || '0')
      )
      
      return targetTime
    } catch (error) {
      console.error('Error converting time between timezones:', error)
      return date
    }
  },

  /**
   * Get current time in specific timezone
   */
  getCurrentTimeInTimezone(timezone: string): Date {
    try {
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      const parts = formatter.formatToParts(now)
      return new Date(
        parseInt(parts.find(p => p.type === 'year')?.value || '0'),
        parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
        parseInt(parts.find(p => p.type === 'day')?.value || '1'),
        parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
        parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
        parseInt(parts.find(p => p.type === 'second')?.value || '0')
      )
    } catch (error) {
      console.error('Error getting current time in timezone:', error)
      return new Date()
    }
  },

  /**
   * Check if time is within business hours
   */
  isWithinBusinessHours(
    time: Date,
    businessHoursStart: string,
    businessHoursEnd: string,
    businessDays: number[]
  ): boolean {
    const dayOfWeek = time.getDay()
    if (!businessDays.includes(dayOfWeek)) {
      return false
    }

    const [startHour, startMinute] = businessHoursStart.split(':').map(Number)
    const [endHour, endMinute] = businessHoursEnd.split(':').map(Number)
    
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute
    const currentTime = time.getHours() * 60 + time.getMinutes()

    return currentTime >= startTime && currentTime < endTime
  },

  /**
   * Format time for display in specific timezone
   */
  formatTimeInTimezone(date: Date, timezone: string, locale = 'en-US'): string {
    try {
      return date.toLocaleString(locale, {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    } catch (error) {
      return date.toISOString()
    }
  }
}