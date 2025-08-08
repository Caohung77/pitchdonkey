import { z } from 'zod'

// Performance monitoring interfaces
export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: string
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

export interface QueryPerformance {
  query: string
  duration: number
  rowsAffected?: number
  cached: boolean
  timestamp: string
  stackTrace?: string
}

export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  size: number
  maxSize: number
  evictions: number
  avgResponseTime: number
}

export interface ConnectionPoolStats {
  active: number
  idle: number
  total: number
  waiting: number
  maxConnections: number
  avgWaitTime: number
  totalRequests: number
}

export interface BackgroundJobStats {
  queued: number
  processing: number
  completed: number
  failed: number
  avgProcessingTime: number
  throughput: number
}

// Configuration interfaces
export interface CacheConfig {
  ttl: number
  maxSize: number
  strategy: 'lru' | 'lfu' | 'fifo'
  compression: boolean
  serialization: 'json' | 'msgpack'
}

export interface DatabaseConfig {
  connectionPool: {
    min: number
    max: number
    acquireTimeoutMillis: number
    idleTimeoutMillis: number
  }
  queryTimeout: number
  slowQueryThreshold: number
  enableQueryLogging: boolean
}

export interface JobQueueConfig {
  concurrency: number
  maxRetries: number
  backoffStrategy: 'exponential' | 'linear' | 'fixed'
  priority: boolean
  rateLimiting: {
    enabled: boolean
    maxJobs: number
    duration: number
  }
}

/**
 * Performance monitoring and optimization manager
 */
export class PerformanceManager {
  private metrics: PerformanceMetric[] = []
  private queryLog: QueryPerformance[] = []
  private cacheStats: Map<string, CacheStats> = new Map()
  private startTime: number = Date.now()

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
      metadata
    }

    this.metrics.push(metric)

    // Keep only recent metrics (last 10000)
    if (this.metrics.length > 10000) {
      this.metrics.shift()
    }
  }

  /**
   * Record database query performance
   */
  recordQuery(
    query: string,
    duration: number,
    rowsAffected?: number,
    cached: boolean = false,
    stackTrace?: string
  ): void {
    const queryPerf: QueryPerformance = {
      query: this.sanitizeQuery(query),
      duration,
      rowsAffected,
      cached,
      timestamp: new Date().toISOString(),
      stackTrace
    }

    this.queryLog.push(queryPerf)

    // Keep only recent queries (last 1000)
    if (this.queryLog.length > 1000) {
      this.queryLog.shift()
    }

    // Record as metric
    this.recordMetric('database.query.duration', duration, 'ms', {
      cached: cached.toString(),
      table: this.extractTableName(query)
    })
  }

  /**
   * Get performance metrics
   */
  getMetrics(
    name?: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): PerformanceMetric[] {
    let filtered = this.metrics

    if (name) {
      filtered = filtered.filter(m => m.name === name)
    }

    if (startTime) {
      filtered = filtered.filter(m => new Date(m.timestamp) >= startTime)
    }

    if (endTime) {
      filtered = filtered.filter(m => new Date(m.timestamp) <= endTime)
    }

    if (tags) {
      filtered = filtered.filter(m => {
        if (!m.tags) return false
        return Object.entries(tags).every(([key, value]) => m.tags![key] === value)
      })
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold: number = 1000, limit: number = 100): QueryPerformance[] {
    return this.queryLog
      .filter(q => q.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  /**
   * Get query statistics
   */
  getQueryStats(): {
    total: number
    totalQueries: number
    avgDuration: number
    slowQueries: number
    cachedQueries: number
    cacheHitRate: number
  } {
    const total = this.queryLog.length
    const avgDuration = total > 0 
      ? this.queryLog.reduce((sum, q) => sum + q.duration, 0) / total 
      : 0
    const slowQueries = this.queryLog.filter(q => q.duration > 1000).length
    const cachedQueries = this.queryLog.filter(q => q.cached).length
    const cacheHitRate = total > 0 ? (cachedQueries / total) * 100 : 0

    return {
      total,
      totalQueries: total,
      avgDuration: Math.round(avgDuration),
      slowQueries,
      cachedQueries,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    }
  }

  /**
   * Update cache statistics
   */
  updateCacheStats(cacheName: string, stats: Partial<CacheStats>): void {
    const existing = this.cacheStats.get(cacheName) || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: 0,
      evictions: 0,
      avgResponseTime: 0
    }

    const updated = { ...existing, ...stats }
    updated.hitRate = updated.hits + updated.misses > 0 
      ? (updated.hits / (updated.hits + updated.misses)) * 100 
      : 0

    this.cacheStats.set(cacheName, updated)
  }

  /**
   * Get cache statistics
   */
  getCacheStats(cacheName?: string): Map<string, CacheStats> | CacheStats | undefined {
    if (cacheName) {
      return this.cacheStats.get(cacheName)
    }
    return this.cacheStats
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    uptime: number
    metrics: {
      total: number
      byName: Record<string, number>
    }
    queries: {
      total: number
      avgDuration: number
      slowQueries: number
      cacheHitRate: number
    }
    cache: Record<string, CacheStats>
    recommendations: string[]
  } {
    const uptime = Date.now() - this.startTime
    const queryStats = this.getQueryStats()
    const recommendations: string[] = []

    // Generate recommendations
    if (queryStats.avgDuration > 500) {
      recommendations.push('Average query duration is high. Consider adding database indexes.')
    }

    if (queryStats.cacheHitRate < 80) {
      recommendations.push('Cache hit rate is low. Review caching strategy.')
    }

    if (queryStats.slowQueries > queryStats.totalQueries * 0.1) {
      recommendations.push('High number of slow queries detected. Optimize query performance.')
    }

    // Metrics by name
    const metricsByName: Record<string, number> = {}
    this.metrics.forEach(metric => {
      metricsByName[metric.name] = (metricsByName[metric.name] || 0) + 1
    })

    return {
      uptime,
      metrics: {
        total: this.metrics.length,
        byName: metricsByName
      },
      queries: queryStats,
      cache: Object.fromEntries(this.cacheStats),
      recommendations
    }
  }

  // Private helper methods
  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries for logging
    return query
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .substring(0, 1000) // Limit query length
  }

  private extractTableName(query: string): string {
    const match = query.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+([`"]?)(\w+)\1/i)
    return match ? match[2] : 'unknown'
  }
}

/**
 * Advanced caching system with multiple strategies
 */
export class CacheManager {
  private caches: Map<string, Cache> = new Map()
  private performanceManager: PerformanceManager

  constructor(performanceManager: PerformanceManager) {
    this.performanceManager = performanceManager
  }

  /**
   * Create or get cache instance
   */
  getCache(name: string, config: CacheConfig): Cache {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Cache(name, config, this.performanceManager))
    }
    return this.caches.get(name)!
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {}
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats()
    })
    return stats
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.caches.forEach(cache => cache.clear())
  }
}

/**
 * Individual cache implementation
 */
class Cache {
  private data: Map<string, { value: any; expiry: number; accessCount: number; lastAccess: number }> = new Map()
  private stats: CacheStats
  private config: CacheConfig
  private performanceManager: PerformanceManager

  constructor(
    private name: string,
    config: CacheConfig,
    performanceManager: PerformanceManager
  ) {
    this.config = config
    this.performanceManager = performanceManager
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: config.maxSize,
      evictions: 0,
      avgResponseTime: 0
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now()
    const item = this.data.get(key)

    if (!item || item.expiry < Date.now()) {
      this.stats.misses++
      this.updateStats(Date.now() - startTime)
      return null
    }

    // Update access information
    item.accessCount++
    item.lastAccess = Date.now()

    this.stats.hits++
    this.updateStats(Date.now() - startTime)

    return item.value
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiry = Date.now() + (ttl || this.config.ttl)
    
    // Check if we need to evict items
    if (this.data.size >= this.config.maxSize) {
      this.evict()
    }

    this.data.set(key, {
      value,
      expiry,
      accessCount: 0,
      lastAccess: Date.now()
    })

    this.stats.size = this.data.size
    this.performanceManager.updateCacheStats(this.name, this.stats)
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.data.delete(key)
    this.stats.size = this.data.size
    this.performanceManager.updateCacheStats(this.name, this.stats)
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.data.clear()
    this.stats.size = 0
    this.performanceManager.updateCacheStats(this.name, this.stats)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Evict items based on strategy
   */
  private evict(): void {
    const itemsToEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1)) // Evict 10%

    switch (this.config.strategy) {
      case 'lru':
        this.evictLRU(itemsToEvict)
        break
      case 'lfu':
        this.evictLFU(itemsToEvict)
        break
      case 'fifo':
        this.evictFIFO(itemsToEvict)
        break
    }

    this.stats.evictions += itemsToEvict
  }

  private evictLRU(count: number): void {
    const entries = Array.from(this.data.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
      .slice(0, count)

    entries.forEach(([key]) => this.data.delete(key))
  }

  private evictLFU(count: number): void {
    const entries = Array.from(this.data.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount)
      .slice(0, count)

    entries.forEach(([key]) => this.data.delete(key))
  }

  private evictFIFO(count: number): void {
    const keys = Array.from(this.data.keys()).slice(0, count)
    keys.forEach(key => this.data.delete(key))
  }

  private updateStats(responseTime: number): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
    this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2
    this.performanceManager.updateCacheStats(this.name, this.stats)
  }
}

/**
 * Database query optimizer
 */
export class QueryOptimizer {
  private performanceManager: PerformanceManager

  constructor(performanceManager: PerformanceManager) {
    this.performanceManager = performanceManager
  }

  /**
   * Wrap database query with performance monitoring
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    query: string,
    useCache: boolean = false,
    cacheKey?: string,
    cacheTtl?: number
  ): Promise<T> {
    const startTime = Date.now()
    let cached = false

    try {
      // Check cache first if enabled
      if (useCache && cacheKey) {
        // Cache implementation would go here
        // For now, we'll just track the attempt
      }

      const result = await queryFn()
      const duration = Date.now() - startTime

      // Record query performance
      this.performanceManager.recordQuery(query, duration, undefined, cached)

      // Cache result if enabled
      if (useCache && cacheKey && !cached) {
        // Cache implementation would go here
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceManager.recordQuery(query, duration, undefined, cached)
      throw error
    }
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  analyzeQuery(query: string): {
    suggestions: string[]
    estimatedImpact: 'low' | 'medium' | 'high'
    indexRecommendations: string[]
  } {
    const suggestions: string[] = []
    const indexRecommendations: string[] = []
    let estimatedImpact: 'low' | 'medium' | 'high' = 'low'

    // Basic query analysis
    const upperQuery = query.toUpperCase()

    // Check for missing WHERE clauses
    if (upperQuery.includes('SELECT') && !upperQuery.includes('WHERE') && !upperQuery.includes('LIMIT')) {
      suggestions.push('Consider adding WHERE clause to limit result set')
      estimatedImpact = 'high'
    }

    // Check for SELECT *
    if (upperQuery.includes('SELECT *')) {
      suggestions.push('Avoid SELECT * - specify only needed columns')
      estimatedImpact = 'medium'
    }

    // Check for N+1 queries pattern
    if (upperQuery.includes('SELECT') && upperQuery.includes('IN (')) {
      suggestions.push('Potential N+1 query detected - consider using JOINs')
      estimatedImpact = 'high'
    }

    // Check for missing LIMIT
    if (upperQuery.includes('SELECT') && !upperQuery.includes('LIMIT')) {
      suggestions.push('Consider adding LIMIT clause for large result sets')
      estimatedImpact = 'medium'
    }

    // Index recommendations based on WHERE clauses
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=/gi)
    if (whereMatch) {
      whereMatch.forEach(match => {
        const column = match.replace(/WHERE\s+/i, '').replace(/\s*=.*/, '')
        indexRecommendations.push(`CREATE INDEX idx_${column} ON table_name (${column})`)
      })
    }

    return {
      suggestions,
      estimatedImpact,
      indexRecommendations
    }
  }
}

/**
 * Background job queue optimizer
 */
export class JobQueueOptimizer {
  private performanceManager: PerformanceManager
  private stats: BackgroundJobStats = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    avgProcessingTime: 0,
    throughput: 0
  }

  constructor(performanceManager: PerformanceManager) {
    this.performanceManager = performanceManager
  }

  /**
   * Process job with performance tracking
   */
  async processJob<T>(
    jobFn: () => Promise<T>,
    jobName: string,
    priority: number = 0
  ): Promise<T> {
    const startTime = Date.now()
    this.stats.processing++

    try {
      const result = await jobFn()
      const duration = Date.now() - startTime

      this.stats.processing--
      this.stats.completed++
      this.stats.avgProcessingTime = (this.stats.avgProcessingTime + duration) / 2

      this.performanceManager.recordMetric(
        'job.processing.duration',
        duration,
        'ms',
        { jobName, priority: priority.toString() }
      )

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.stats.processing--
      this.stats.failed++

      this.performanceManager.recordMetric(
        'job.processing.duration',
        duration,
        'ms',
        { jobName, priority: priority.toString(), status: 'failed' }
      )

      throw error
    }
  }

  /**
   * Get job queue statistics
   */
  getStats(): BackgroundJobStats {
    return { ...this.stats }
  }

  /**
   * Update queue statistics
   */
  updateStats(stats: Partial<BackgroundJobStats>): void {
    this.stats = { ...this.stats, ...stats }
  }
}

/**
 * Resource pool manager for connections, etc.
 */
export class ResourcePoolManager {
  private pools: Map<string, ResourcePool<any>> = new Map()
  private performanceManager: PerformanceManager

  constructor(performanceManager: PerformanceManager) {
    this.performanceManager = performanceManager
  }

  /**
   * Create or get resource pool
   */
  getPool<T>(
    name: string,
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    config: {
      min: number
      max: number
      acquireTimeoutMillis: number
      idleTimeoutMillis: number
    }
  ): ResourcePool<T> {
    if (!this.pools.has(name)) {
      this.pools.set(name, new ResourcePool(name, factory, destroyer, config, this.performanceManager))
    }
    return this.pools.get(name) as ResourcePool<T>
  }

  /**
   * Get all pool statistics
   */
  getAllStats(): Record<string, ConnectionPoolStats> {
    const stats: Record<string, ConnectionPoolStats> = {}
    this.pools.forEach((pool, name) => {
      stats[name] = pool.getStats()
    })
    return stats
  }
}

/**
 * Generic resource pool implementation
 */
class ResourcePool<T> {
  private available: T[] = []
  private inUse: Set<T> = new Set()
  private waiting: Array<{ resolve: (resource: T) => void; reject: (error: Error) => void }> = []
  private stats: ConnectionPoolStats

  constructor(
    private name: string,
    private factory: () => Promise<T>,
    private destroyer: (resource: T) => Promise<void>,
    private config: {
      min: number
      max: number
      acquireTimeoutMillis: number
      idleTimeoutMillis: number
    },
    private performanceManager: PerformanceManager
  ) {
    this.stats = {
      active: 0,
      idle: 0,
      total: 0,
      waiting: 0,
      maxConnections: config.max,
      avgWaitTime: 0,
      totalRequests: 0
    }

    // Initialize minimum connections
    this.initializePool()
  }

  /**
   * Acquire resource from pool
   */
  async acquire(): Promise<T> {
    const startTime = Date.now()
    this.stats.totalRequests++

    return new Promise<T>((resolve, reject) => {
      // Check if resource is available
      if (this.available.length > 0) {
        const resource = this.available.pop()!
        this.inUse.add(resource)
        this.updateStats()
        
        const waitTime = Date.now() - startTime
        this.stats.avgWaitTime = (this.stats.avgWaitTime + waitTime) / 2
        
        resolve(resource)
        return
      }

      // Check if we can create new resource
      if (this.getTotalCount() < this.config.max) {
        this.createResource()
          .then(resource => {
            this.inUse.add(resource)
            this.updateStats()
            
            const waitTime = Date.now() - startTime
            this.stats.avgWaitTime = (this.stats.avgWaitTime + waitTime) / 2
            
            resolve(resource)
          })
          .catch(reject)
        return
      }

      // Add to waiting queue
      this.waiting.push({ resolve, reject })
      this.stats.waiting = this.waiting.length

      // Set timeout
      setTimeout(() => {
        const index = this.waiting.findIndex(w => w.resolve === resolve)
        if (index !== -1) {
          this.waiting.splice(index, 1)
          this.stats.waiting = this.waiting.length
          reject(new Error('Resource acquisition timeout'))
        }
      }, this.config.acquireTimeoutMillis)
    })
  }

  /**
   * Release resource back to pool
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      return
    }

    this.inUse.delete(resource)
    this.available.push(resource)
    this.updateStats()

    // Serve waiting requests
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!
      const waitingResource = this.available.pop()!
      this.inUse.add(waitingResource)
      this.stats.waiting = this.waiting.length
      this.updateStats()
      waiter.resolve(waitingResource)
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats }
  }

  private async initializePool(): Promise<void> {
    const promises = []
    for (let i = 0; i < this.config.min; i++) {
      promises.push(this.createResource())
    }
    
    const resources = await Promise.all(promises)
    this.available.push(...resources)
    this.updateStats()
  }

  private async createResource(): Promise<T> {
    const resource = await this.factory()
    return resource
  }

  private getTotalCount(): number {
    return this.available.length + this.inUse.size
  }

  private updateStats(): void {
    this.stats.active = this.inUse.size
    this.stats.idle = this.available.length
    this.stats.total = this.getTotalCount()
    
    this.performanceManager.recordMetric(
      'pool.connections.active',
      this.stats.active,
      'count',
      { pool: this.name }
    )
  }
}

// Export singleton instances
export const performanceManager = new PerformanceManager()
export const cacheManager = new CacheManager(performanceManager)
export const queryOptimizer = new QueryOptimizer(performanceManager)
export const jobQueueOptimizer = new JobQueueOptimizer(performanceManager)
export const resourcePoolManager = new ResourcePoolManager(performanceManager)

// Default configurations
export const defaultConfigs = {
  cache: {
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    strategy: 'lru' as const,
    compression: false,
    serialization: 'json' as const
  },
  database: {
    connectionPool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000
    },
    queryTimeout: 30000,
    slowQueryThreshold: 1000,
    enableQueryLogging: true
  },
  jobQueue: {
    concurrency: 5,
    maxRetries: 3,
    backoffStrategy: 'exponential' as const,
    priority: true,
    rateLimiting: {
      enabled: true,
      maxJobs: 100,
      duration: 60000
    }
  }
}

// Validation schemas
export const performanceConfigSchema = z.object({
  cache: z.object({
    ttl: z.number().min(1000),
    maxSize: z.number().min(10),
    strategy: z.enum(['lru', 'lfu', 'fifo']),
    compression: z.boolean(),
    serialization: z.enum(['json', 'msgpack'])
  }),
  database: z.object({
    connectionPool: z.object({
      min: z.number().min(1),
      max: z.number().min(1),
      acquireTimeoutMillis: z.number().min(1000),
      idleTimeoutMillis: z.number().min(10000)
    }),
    queryTimeout: z.number().min(1000),
    slowQueryThreshold: z.number().min(100),
    enableQueryLogging: z.boolean()
  }),
  jobQueue: z.object({
    concurrency: z.number().min(1),
    maxRetries: z.number().min(0),
    backoffStrategy: z.enum(['exponential', 'linear', 'fixed']),
    priority: z.boolean(),
    rateLimiting: z.object({
      enabled: z.boolean(),
      maxJobs: z.number().min(1),
      duration: z.number().min(1000)
    })
  })
})