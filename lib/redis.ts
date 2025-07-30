import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Missing Upstash Redis configuration')
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Cache keys
export const CACHE_KEYS = {
  USER: (userId: string) => `user:${userId}`,
  EMAIL_ACCOUNTS: (userId: string) => `email_accounts:${userId}`,
  CONTACTS: (userId: string) => `contacts:${userId}`,
  CAMPAIGNS: (userId: string) => `campaigns:${userId}`,
  CAMPAIGN: (campaignId: string) => `campaign:${campaignId}`,
  WARMUP_STATUS: (accountId: string) => `warmup:${accountId}`,
  ANALYTICS: (userId: string, period: string) => `analytics:${userId}:${period}`,
  RATE_LIMIT: (accountId: string, date: string) => `rate_limit:${accountId}:${date}`,
}

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
}

// Helper functions for common cache operations
export const cacheHelpers = {
  // Get cached data with fallback
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    try {
      const cached = await redis.get(key)
      if (cached) {
        return cached as T
      }

      const data = await fetcher()
      await redis.setex(key, ttl, JSON.stringify(data))
      return data
    } catch (error) {
      console.error('Cache error:', error)
      // Fallback to direct fetch if cache fails
      return await fetcher()
    }
  },

  // Invalidate cache patterns
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  },

  // Set cache with TTL
  async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  },

  // Get cached data
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      return data as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  // Delete cache key
  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  },
}

// Rate limiting helpers
export const rateLimitHelpers = {
  // Check and increment rate limit
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number = 86400 // 24 hours default
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const current = await redis.incr(key)
      
      if (current === 1) {
        await redis.expire(key, windowSeconds)
      }

      const ttl = await redis.ttl(key)
      const resetTime = Date.now() + (ttl * 1000)

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
      }
    } catch (error) {
      console.error('Rate limit error:', error)
      // Fail open - allow the request if rate limiting fails
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
      }
    }
  },

  // Get current rate limit status
  async getRateLimitStatus(
    key: string,
    limit: number
  ): Promise<{ current: number; remaining: number; resetTime: number }> {
    try {
      const current = await redis.get(key) || 0
      const ttl = await redis.ttl(key)
      const resetTime = Date.now() + (ttl * 1000)

      return {
        current: Number(current),
        remaining: Math.max(0, limit - Number(current)),
        resetTime,
      }
    } catch (error) {
      console.error('Rate limit status error:', error)
      return {
        current: 0,
        remaining: limit,
        resetTime: Date.now() + 86400000, // 24 hours
      }
    }
  },
}