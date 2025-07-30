import {
  SystemMonitor,
  HealthStatus,
  AlertType,
  AlertSeverity,
  defaultMonitoringConfig
} from '../../lib/monitoring'

describe('SystemMonitor', () => {
  let monitor: SystemMonitor

  beforeEach(() => {
    monitor = new SystemMonitor(defaultMonitoringConfig)
  })

  describe('Health Checks', () => {
    it('should register and run health checks', async () => {
      // Register a custom health check
      monitor.registerHealthCheck('test_service', async () => ({
        name: 'test_service',
        status: HealthStatus.HEALTHY,
        message: 'Test service is healthy',
        timestamp: new Date().toISOString()
      }))

      const health = await monitor.runHealthChecks()

      expect(health.status).toBeDefined()
      expect(health.version).toBeDefined()
      expect(health.uptime).toBeGreaterThan(0)
      expect(health.checks).toBeInstanceOf(Array)
      expect(health.checks.length).toBeGreaterThan(0)
      expect(health.summary.total).toBe(health.checks.length)

      // Check if our custom health check is included
      const testCheck = health.checks.find(c => c.name === 'test_service')
      expect(testCheck).toBeDefined()
      expect(testCheck?.status).toBe(HealthStatus.HEALTHY)
    })

    it('should handle health check timeouts', async () => {
      // Register a health check that takes too long
      monitor.registerHealthCheck('slow_service', async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
        return {
          name: 'slow_service',
          status: HealthStatus.HEALTHY,
          message: 'This should timeout',
          timestamp: new Date().toISOString()
        }
      })

      const health = await monitor.runHealthChecks()
      const slowCheck = health.checks.find(c => c.name === 'slow_service')
      
      expect(slowCheck).toBeDefined()
      expect(slowCheck?.status).toBe(HealthStatus.UNHEALTHY)
      expect(slowCheck?.message).toContain('timeout')
    })

    it('should handle health check errors', async () => {
      // Register a health check that throws an error
      monitor.registerHealthCheck('failing_service', async () => {
        throw new Error('Service is down')
      })

      const health = await monitor.runHealthChecks()
      const failingCheck = health.checks.find(c => c.name === 'failing_service')
      
      expect(failingCheck).toBeDefined()
      expect(failingCheck?.status).toBe(HealthStatus.UNHEALTHY)
      expect(failingCheck?.message).toBe('Service is down')
    })

    it('should calculate overall system health correctly', async () => {
      // Register multiple health checks with different statuses
      monitor.registerHealthCheck('healthy_service', async () => ({
        name: 'healthy_service',
        status: HealthStatus.HEALTHY,
        message: 'All good',
        timestamp: new Date().toISOString()
      }))

      monitor.registerHealthCheck('degraded_service', async () => ({
        name: 'degraded_service',
        status: HealthStatus.DEGRADED,
        message: 'Some issues',
        timestamp: new Date().toISOString()
      }))

      const health = await monitor.runHealthChecks()
      
      // Should be degraded because we have at least one degraded service
      expect(health.status).toBe(HealthStatus.DEGRADED)
      expect(health.summary.healthy).toBeGreaterThan(0)
      expect(health.summary.degraded).toBeGreaterThan(0)
    })

    it('should set overall status to unhealthy when any service is unhealthy', async () => {
      monitor.registerHealthCheck('unhealthy_service', async () => ({
        name: 'unhealthy_service',
        status: HealthStatus.UNHEALTHY,
        message: 'Service is down',
        timestamp: new Date().toISOString()
      }))

      const health = await monitor.runHealthChecks()
      
      expect(health.status).toBe(HealthStatus.UNHEALTHY)
      expect(health.summary.unhealthy).toBeGreaterThan(0)
    })
  })

  describe('Performance Metrics', () => {
    it('should collect performance metrics', async () => {
      const metrics = await monitor.collectMetrics()

      expect(metrics.timestamp).toBeDefined()
      expect(metrics.cpu).toBeDefined()
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0)
      expect(metrics.cpu.loadAverage).toBeInstanceOf(Array)
      
      expect(metrics.memory).toBeDefined()
      expect(metrics.memory.used).toBeGreaterThan(0)
      expect(metrics.memory.total).toBeGreaterThan(0)
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0)
      
      expect(metrics.database).toBeDefined()
      expect(metrics.database.connections).toBeDefined()
      expect(metrics.database.queryTime).toBeDefined()
      
      expect(metrics.redis).toBeDefined()
      expect(metrics.api).toBeDefined()
      expect(metrics.external).toBeDefined()
    })

    it('should store and retrieve recent metrics', async () => {
      // Collect some metrics
      await monitor.collectMetrics()
      await monitor.collectMetrics()
      await monitor.collectMetrics()

      const recentMetrics = monitor.getRecentMetrics(60)
      expect(recentMetrics.length).toBe(3)
      
      // Each metric should have a timestamp
      recentMetrics.forEach(metric => {
        expect(metric.timestamp).toBeDefined()
        expect(new Date(metric.timestamp)).toBeInstanceOf(Date)
      })
    })

    it('should limit stored metrics to prevent memory issues', async () => {
      // Collect many metrics (more than the limit of 1000)
      for (let i = 0; i < 1005; i++) {
        await monitor.collectMetrics()
      }

      const allMetrics = monitor.getRecentMetrics(24 * 60) // 24 hours
      expect(allMetrics.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Alerts', () => {
    it('should create and store alerts', async () => {
      const alert = await monitor.createAlert(
        AlertType.SYSTEM,
        AlertSeverity.WARNING,
        'Test Alert',
        'This is a test alert',
        'test_source',
        { testData: 'value' }
      )

      expect(alert.id).toBeDefined()
      expect(alert.type).toBe(AlertType.SYSTEM)
      expect(alert.severity).toBe(AlertSeverity.WARNING)
      expect(alert.title).toBe('Test Alert')
      expect(alert.message).toBe('This is a test alert')
      expect(alert.source).toBe('test_source')
      expect(alert.resolved).toBe(false)
      expect(alert.metadata?.testData).toBe('value')

      const activeAlerts = monitor.getActiveAlerts()
      expect(activeAlerts).toContain(alert)
    })

    it('should resolve alerts', async () => {
      const alert = await monitor.createAlert(
        AlertType.PERFORMANCE,
        AlertSeverity.ERROR,
        'Performance Issue',
        'High CPU usage detected',
        'system_monitor'
      )

      expect(alert.resolved).toBe(false)

      await monitor.resolveAlert(alert.id)

      const activeAlerts = monitor.getActiveAlerts()
      expect(activeAlerts).not.toContain(alert)
      expect(alert.resolved).toBe(true)
      expect(alert.resolvedAt).toBeDefined()
    })

    it('should filter active vs all alerts', async () => {
      const alert1 = await monitor.createAlert(
        AlertType.SYSTEM,
        AlertSeverity.INFO,
        'Info Alert',
        'Information message',
        'test'
      )

      const alert2 = await monitor.createAlert(
        AlertType.DATABASE,
        AlertSeverity.ERROR,
        'Database Alert',
        'Database connection issue',
        'test'
      )

      // Resolve one alert
      await monitor.resolveAlert(alert1.id)

      const activeAlerts = monitor.getActiveAlerts()
      const allAlerts = monitor.getAllAlerts()

      expect(activeAlerts.length).toBe(1)
      expect(activeAlerts[0]).toBe(alert2)
      expect(allAlerts.length).toBe(2)
    })

    it('should limit returned alerts', async () => {
      // Create many alerts
      for (let i = 0; i < 150; i++) {
        await monitor.createAlert(
          AlertType.SYSTEM,
          AlertSeverity.INFO,
          `Alert ${i}`,
          `Message ${i}`,
          'test'
        )
      }

      const allAlerts = monitor.getAllAlerts(100)
      expect(allAlerts.length).toBe(100)
    })

    it('should sort alerts by timestamp (newest first)', async () => {
      const alert1 = await monitor.createAlert(
        AlertType.SYSTEM,
        AlertSeverity.INFO,
        'First Alert',
        'First message',
        'test'
      )

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const alert2 = await monitor.createAlert(
        AlertType.SYSTEM,
        AlertSeverity.INFO,
        'Second Alert',
        'Second message',
        'test'
      )

      const allAlerts = monitor.getAllAlerts()
      expect(allAlerts[0]).toBe(alert2) // Newest first
      expect(allAlerts[1]).toBe(alert1)
    })
  })

  describe('Default Health Checks', () => {
    it('should have default health checks registered', async () => {
      const health = await monitor.runHealthChecks()
      
      const checkNames = health.checks.map(c => c.name)
      expect(checkNames).toContain('database')
      expect(checkNames).toContain('redis')
      expect(checkNames).toContain('external_services')
      expect(checkNames).toContain('disk_space')
    })

    it('should handle database health check', async () => {
      const health = await monitor.runHealthChecks()
      const dbCheck = health.checks.find(c => c.name === 'database')
      
      expect(dbCheck).toBeDefined()
      expect(dbCheck?.status).toBeDefined()
      expect(dbCheck?.timestamp).toBeDefined()
    })

    it('should handle redis health check', async () => {
      const health = await monitor.runHealthChecks()
      const redisCheck = health.checks.find(c => c.name === 'redis')
      
      expect(redisCheck).toBeDefined()
      expect(redisCheck?.status).toBeDefined()
      expect(redisCheck?.timestamp).toBeDefined()
    })

    it('should handle external services health check', async () => {
      const health = await monitor.runHealthChecks()
      const externalCheck = health.checks.find(c => c.name === 'external_services')
      
      expect(externalCheck).toBeDefined()
      expect(externalCheck?.status).toBeDefined()
      expect(externalCheck?.metadata?.services).toBeDefined()
    })

    it('should handle disk space health check', async () => {
      const health = await monitor.runHealthChecks()
      const diskCheck = health.checks.find(c => c.name === 'disk_space')
      
      expect(diskCheck).toBeDefined()
      expect(diskCheck?.status).toBeDefined()
      expect(diskCheck?.metadata?.usage).toBeDefined()
    })
  })

  describe('Alert Thresholds', () => {
    it('should create alerts when thresholds are exceeded', async () => {
      // Mock high CPU usage
      const originalGetCPUMetrics = (monitor as any).getCPUMetrics
      ;(monitor as any).getCPUMetrics = async () => ({
        usage: 95, // Above threshold of 80
        loadAverage: [1.0, 1.0, 1.0]
      })

      await monitor.collectMetrics()

      const activeAlerts = monitor.getActiveAlerts()
      const cpuAlert = activeAlerts.find(a => a.title === 'High CPU Usage')
      
      expect(cpuAlert).toBeDefined()
      expect(cpuAlert?.severity).toBe(AlertSeverity.WARNING)
      expect(cpuAlert?.metadata?.cpuUsage).toBe(95)

      // Restore original method
      ;(monitor as any).getCPUMetrics = originalGetCPUMetrics
    })

    it('should create memory usage alerts', async () => {
      // Mock high memory usage
      const originalGetMemoryMetrics = (monitor as any).getMemoryMetrics
      ;(monitor as any).getMemoryMetrics = async () => ({
        used: 900 * 1024 * 1024, // 900MB
        total: 1024 * 1024 * 1024, // 1GB
        percentage: 90, // Above threshold of 85
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      })

      await monitor.collectMetrics()

      const activeAlerts = monitor.getActiveAlerts()
      const memoryAlert = activeAlerts.find(a => a.title === 'High Memory Usage')
      
      expect(memoryAlert).toBeDefined()
      expect(memoryAlert?.severity).toBe(AlertSeverity.WARNING)

      // Restore original method
      ;(monitor as any).getMemoryMetrics = originalGetMemoryMetrics
    })

    it('should create response time alerts', async () => {
      // Mock high response time
      const originalGetAPIMetrics = (monitor as any).getAPIMetrics
      ;(monitor as any).getAPIMetrics = async () => ({
        requestsPerMinute: 100,
        averageResponseTime: 3000, // Above threshold of 2000ms
        errorRate: 1,
        activeConnections: 50
      })

      await monitor.collectMetrics()

      const activeAlerts = monitor.getActiveAlerts()
      const responseTimeAlert = activeAlerts.find(a => a.title === 'High Response Time')
      
      expect(responseTimeAlert).toBeDefined()
      expect(responseTimeAlert?.severity).toBe(AlertSeverity.WARNING)

      // Restore original method
      ;(monitor as any).getAPIMetrics = originalGetAPIMetrics
    })

    it('should create error rate alerts', async () => {
      // Mock high error rate
      const originalGetAPIMetrics = (monitor as any).getAPIMetrics
      ;(monitor as any).getAPIMetrics = async () => ({
        requestsPerMinute: 100,
        averageResponseTime: 200,
        errorRate: 10, // Above threshold of 5%
        activeConnections: 50
      })

      await monitor.collectMetrics()

      const activeAlerts = monitor.getActiveAlerts()
      const errorRateAlert = activeAlerts.find(a => a.title === 'High Error Rate')
      
      expect(errorRateAlert).toBeDefined()
      expect(errorRateAlert?.severity).toBe(AlertSeverity.ERROR)

      // Restore original method
      ;(monitor as any).getAPIMetrics = originalGetAPIMetrics
    })
  })
})