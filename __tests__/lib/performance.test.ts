import {
  PerformanceManager,
  CacheManager,
  QueryOptimizer,
  JobQueueOptimizer,
  ResourcePoolManager,
  defaultConfigs
} from '../../lib/performance'

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager

  beforeEach(() => {
    performanceManager = new PerformanceManager()
  })

  describe('recordMetric', () => {
    it('should record performance metrics', () => {
      performanceManager.recordMetric('test.metric', 100, 'ms', { tag: 'value' })
      
      const metrics = performanceManager.getMetrics('test.metric')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('test.metric')
      expect(metrics[0].value).toBe(100)
      expect(metrics[0].unit).toBe('ms')
      expect(metrics[0].tags?.tag).toBe('value')
    })

    it('should limit stored metrics', () => {
      // Record more than the limit
      for (let i = 0; i < 10005; i++) {
        performanceManager.recordMetric('test.metric', i)
      }
      
      const metrics = performanceManager.getMetrics()
      expect(metrics.length).toBeLessThanOrEqual(10000)
    })
  })

  describe('recordQuery', () => {
    it('should record database query performance', () => {
      performanceManager.recordQuery('SELECT * FROM users', 150, 10, false)
      
      const queries = performanceManager.getSlowQueries(0)
      expect(queries).toHaveLength(1)
      expect(queries[0].query).toBe('SELECT * FROM users')
      expect(queries[0].duration).toBe(150)
      expect(queries[0].rowsAffected).toBe(10)
      expect(queries[0].cached).toBe(false)
    })

    it('should sanitize sensitive data in queries', () => {
      performanceManager.recordQuery(
        'SELECT * FROM users WHERE email = "test@example.com"',
        100
      )
      
      const queries = performanceManager.getSlowQueries(0)
      expect(queries[0].query).toContain('[EMAIL]')
      expect(queries[0].query).not.toContain('test@example.com')
    })

    it('should limit query log size', () => {
      for (let i = 0; i < 1005; i++) {
        performanceManager.recordQuery(`SELECT ${i}`, 100)
      }
      
      const queries = performanceManager.getSlowQueries(0, 2000)
      expect(queries.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('getSlowQueries', () => {
    it('should return queries above threshold', () => {
      performanceManager.recordQuery('FAST QUERY', 50)
      performanceManager.recordQuery('SLOW QUERY', 1500)
      performanceManager.recordQuery('VERY SLOW QUERY', 3000)
      
      const slowQueries = performanceManager.getSlowQueries(1000)
      expect(slowQueries).toHaveLength(2)
      expect(slowQueries[0].query).toBe('VERY SLOW QUERY') // Sorted by duration desc
      expect(slowQueries[1].query).toBe('SLOW QUERY')
    })

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        performanceManager.recordQuery(`SLOW QUERY ${i}`, 2000)
      }
      
      const slowQueries = performanceManager.getSlowQueries(1000, 5)
      expect(slowQueries).toHaveLength(5)
    })
  })

  describe('getQueryStats', () => {
    it('should calculate query statistics', () => {
      performanceManager.recordQuery('QUERY 1', 100, undefined, false)
      performanceManager.recordQuery('QUERY 2', 200, undefined, true)
      performanceManager.recordQuery('QUERY 3', 1500, undefined, false)
      
      const stats = performanceManager.getQueryStats()
      expect(stats.totalQueries).toBe(3)
      expect(stats.avgDuration).toBe(600) // (100 + 200 + 1500) / 3
      expect(stats.slowQueries).toBe(1) // > 1000ms
      expect(stats.cachedQueries).toBe(1)
      expect(stats.cacheHitRate).toBe(33.33) // 1/3 * 100
    })

    it('should handle empty query log', () => {
      const stats = performanceManager.getQueryStats()
      expect(stats.totalQueries).toBe(0)
      expect(stats.avgDuration).toBe(0)
      expect(stats.cacheHitRate).toBe(0)
    })
  })

  describe('generateReport', () => {
    it('should generate comprehensive performance report', () => {
      performanceManager.recordMetric('api.response.time', 150)
      performanceManager.recordMetric('api.response.time', 200)
      performanceManager.recordQuery('SELECT * FROM users', 2000) // Slow query
      
      const report = performanceManager.generateReport()
      
      expect(report.uptime).toBeGreaterThan(0)
      expect(report.metrics.total).toBe(2)
      expect(report.metrics.byName['api.response.time']).toBe(2)
      expect(report.queries.totalQueries).toBe(1)
      expect(report.recommendations).toContain(
        'Average query duration is high. Consider adding database indexes.'
      )
    })
  })
})

describe('CacheManager', () => {
  let performanceManager: PerformanceManager
  let cacheManager: CacheManager

  beforeEach(() => {
    performanceManager = new PerformanceManager()
    cacheManager = new CacheManager(performanceManager)
  })

  describe('cache operations', () => {
    it('should create and use cache', async () => {
      const cache = cacheManager.getCache('test-cache', defaultConfigs.cache)
      
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')
      
      expect(value).toBe('value1')
    })

    it('should handle cache expiration', async () => {
      const cache = cacheManager.getCache('test-cache', {
        ...defaultConfigs.cache,
        ttl: 10 // 10ms
      })
      
      await cache.set('key1', 'value1')
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 15))
      
      const value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should track cache statistics', async () => {
      const cache = cacheManager.getCache('test-cache', defaultConfigs.cache)
      
      await cache.set('key1', 'value1')
      await cache.get('key1') // Hit
      await cache.get('key2') // Miss
      
      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(50)
    })

    it('should evict items when cache is full', async () => {
      const cache = cacheManager.getCache('test-cache', {
        ...defaultConfigs.cache,
        maxSize: 2,
        strategy: 'lru'
      })
      
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3') // Should evict key1
      
      const value1 = await cache.get('key1')
      const value3 = await cache.get('key3')
      
      expect(value1).toBeNull()
      expect(value3).toBe('value3')
    })
  })

  describe('eviction strategies', () => {
    it('should implement LRU eviction', async () => {
      const cache = cacheManager.getCache('lru-cache', {
        ...defaultConfigs.cache,
        maxSize: 2,
        strategy: 'lru'
      })
      
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.get('key1') // Access key1 to make it recently used
      await cache.set('key3', 'value3') // Should evict key2 (least recently used)
      
      const value1 = await cache.get('key1')
      const value2 = await cache.get('key2')
      const value3 = await cache.get('key3')
      
      expect(value1).toBe('value1')
      expect(value2).toBeNull()
      expect(value3).toBe('value3')
    })
  })
})

describe('QueryOptimizer', () => {
  let performanceManager: PerformanceManager
  let queryOptimizer: QueryOptimizer

  beforeEach(() => {
    performanceManager = new PerformanceManager()
    queryOptimizer = new QueryOptimizer(performanceManager)
  })

  describe('executeQuery', () => {
    it('should execute query and record performance', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] })
      
      const result = await queryOptimizer.executeQuery(
        mockQueryFn,
        'SELECT * FROM users WHERE id = 1'
      )
      
      expect(result).toEqual({ rows: [{ id: 1 }] })
      expect(mockQueryFn).toHaveBeenCalled()
      
      const queries = performanceManager.getSlowQueries(0)
      expect(queries).toHaveLength(1)
      expect(queries[0].query).toBe('SELECT * FROM users WHERE id = 1')
    })

    it('should handle query errors', async () => {
      const mockQueryFn = jest.fn().mockRejectedValue(new Error('Database error'))
      
      await expect(
        queryOptimizer.executeQuery(mockQueryFn, 'INVALID QUERY')
      ).rejects.toThrow('Database error')
      
      const queries = performanceManager.getSlowQueries(0)
      expect(queries).toHaveLength(1)
    })
  })

  describe('analyzeQuery', () => {
    it('should detect missing WHERE clause', () => {
      const analysis = queryOptimizer.analyzeQuery('SELECT * FROM users')
      
      expect(analysis.suggestions).toContain(
        'Consider adding WHERE clause to limit result set'
      )
      expect(analysis.estimatedImpact).toBe('high')
    })

    it('should detect SELECT *', () => {
      const analysis = queryOptimizer.analyzeQuery('SELECT * FROM users WHERE id = 1')
      
      expect(analysis.suggestions).toContain(
        'Avoid SELECT * - specify only needed columns'
      )
      expect(analysis.estimatedImpact).toBe('medium')
    })

    it('should suggest indexes for WHERE clauses', () => {
      const analysis = queryOptimizer.analyzeQuery('SELECT name FROM users WHERE email = ?')
      
      expect(analysis.indexRecommendations).toContain(
        'CREATE INDEX idx_email ON table_name (email)'
      )
    })

    it('should detect potential N+1 queries', () => {
      const analysis = queryOptimizer.analyzeQuery('SELECT * FROM posts WHERE user_id IN (1,2,3)')
      
      expect(analysis.suggestions).toContain(
        'Potential N+1 query detected - consider using JOINs'
      )
      expect(analysis.estimatedImpact).toBe('high')
    })
  })
})

describe('JobQueueOptimizer', () => {
  let performanceManager: PerformanceManager
  let jobQueueOptimizer: JobQueueOptimizer

  beforeEach(() => {
    performanceManager = new PerformanceManager()
    jobQueueOptimizer = new JobQueueOptimizer(performanceManager)
  })

  describe('processJob', () => {
    it('should process job and record performance', async () => {
      const mockJobFn = jest.fn().mockResolvedValue('job result')
      
      const result = await jobQueueOptimizer.processJob(mockJobFn, 'test-job', 1)
      
      expect(result).toBe('job result')
      expect(mockJobFn).toHaveBeenCalled()
      
      const stats = jobQueueOptimizer.getStats()
      expect(stats.completed).toBe(1)
      expect(stats.processing).toBe(0)
      expect(stats.avgProcessingTime).toBeGreaterThan(0)
    })

    it('should handle job failures', async () => {
      const mockJobFn = jest.fn().mockRejectedValue(new Error('Job failed'))
      
      await expect(
        jobQueueOptimizer.processJob(mockJobFn, 'failing-job')
      ).rejects.toThrow('Job failed')
      
      const stats = jobQueueOptimizer.getStats()
      expect(stats.failed).toBe(1)
      expect(stats.processing).toBe(0)
    })

    it('should track concurrent job processing', async () => {
      const mockJobFn = () => new Promise(resolve => setTimeout(() => resolve('done'), 50))
      
      // Start multiple jobs concurrently
      const promises = [
        jobQueueOptimizer.processJob(mockJobFn, 'job1'),
        jobQueueOptimizer.processJob(mockJobFn, 'job2'),
        jobQueueOptimizer.processJob(mockJobFn, 'job3')
      ]
      
      // Check processing count before completion
      await new Promise(resolve => setTimeout(resolve, 10))
      const stats = jobQueueOptimizer.getStats()
      expect(stats.processing).toBe(3)
      
      await Promise.all(promises)
      
      const finalStats = jobQueueOptimizer.getStats()
      expect(finalStats.processing).toBe(0)
      expect(finalStats.completed).toBe(3)
    })
  })
})

describe('ResourcePoolManager', () => {
  let performanceManager: PerformanceManager
  let resourcePoolManager: ResourcePoolManager

  beforeEach(() => {
    performanceManager = new PerformanceManager()
    resourcePoolManager = new ResourcePoolManager(performanceManager)
  })

  describe('resource pool operations', () => {
    it('should create and manage resource pool', async () => {
      let resourceId = 0
      const factory = async () => ({ id: ++resourceId })
      const destroyer = async (resource: any) => { /* cleanup */ }
      
      const pool = resourcePoolManager.getPool('test-pool', factory, destroyer, {
        min: 1,
        max: 3,
        acquireTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
      })
      
      const resource1 = await pool.acquire()
      const resource2 = await pool.acquire()
      
      expect(resource1.id).toBe(1)
      expect(resource2.id).toBe(2)
      
      await pool.release(resource1)
      await pool.release(resource2)
      
      const stats = pool.getStats()
      expect(stats.active).toBe(0)
      expect(stats.idle).toBeGreaterThan(0)
    })

    it('should handle resource pool limits', async () => {
      const factory = async () => ({ id: Math.random() })
      const destroyer = async (resource: any) => { /* cleanup */ }
      
      const pool = resourcePoolManager.getPool('limited-pool', factory, destroyer, {
        min: 1,
        max: 2,
        acquireTimeoutMillis: 100,
        idleTimeoutMillis: 30000
      })
      
      const resource1 = await pool.acquire()
      const resource2 = await pool.acquire()
      
      // Third acquisition should timeout
      await expect(pool.acquire()).rejects.toThrow('Resource acquisition timeout')
      
      await pool.release(resource1)
      await pool.release(resource2)
    })

    it('should track pool statistics', async () => {
      const factory = async () => ({ id: Math.random() })
      const destroyer = async (resource: any) => { /* cleanup */ }
      
      const pool = resourcePoolManager.getPool('stats-pool', factory, destroyer, {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
      })
      
      const resource = await pool.acquire()
      
      const stats = pool.getStats()
      expect(stats.active).toBe(1)
      expect(stats.totalRequests).toBe(1)
      expect(stats.maxConnections).toBe(5)
      
      await pool.release(resource)
      
      const finalStats = pool.getStats()
      expect(finalStats.active).toBe(0)
      expect(finalStats.idle).toBeGreaterThan(0)
    })
  })
})

describe('Performance Integration', () => {
  it('should work together for comprehensive performance monitoring', async () => {
    const performanceManager = new PerformanceManager()
    const cacheManager = new CacheManager(performanceManager)
    const queryOptimizer = new QueryOptimizer(performanceManager)
    
    // Simulate some operations
    const cache = cacheManager.getCache('integration-cache', defaultConfigs.cache)
    await cache.set('user:1', { name: 'John' })
    await cache.get('user:1')
    await cache.get('user:2') // Miss
    
    const mockQuery = jest.fn().mockResolvedValue([{ id: 1 }])
    await queryOptimizer.executeQuery(mockQuery, 'SELECT * FROM users WHERE id = 1')
    
    performanceManager.recordMetric('api.request.duration', 250, 'ms')
    
    // Generate report
    const report = performanceManager.generateReport()
    
    expect(report.metrics.total).toBeGreaterThan(0)
    expect(report.queries.totalQueries).toBe(1)
    expect(report.cache).toBeDefined()
    
    const cacheStats = cacheManager.getAllStats()
    expect(cacheStats['integration-cache']).toBeDefined()
    expect(cacheStats['integration-cache'].hits).toBe(1)
    expect(cacheStats['integration-cache'].misses).toBe(1)
  })
})