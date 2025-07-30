import { z } from 'zod'

// Health check interfaces
export interface HealthCheck {
  name: string
  status: HealthStatus
  message?: string
  duration?: number
  timestamp: string
  metadata?: Record<string, any>
}

export interface SystemHealth {
  status: HealthStatus
  version: string
  uptime: number
  timestamp: string
  checks: HealthCheck[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    degraded: number
  }
}

export interface PerformanceMetrics {
  timestamp: string
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    total: number
    percentage: number
    heapUsed: number
    heapTotal: number
  }
  database: {
    connections: {
      active: number
      idle: number
      total: number
    }
    queryTime: {
      avg: number
      p95: number
      p99: number
    }
    slowQueries: number
  }
  redis: {
    connections: number
    memory: number
    keyspace: {
      keys: number
      expires: number
    }
    commandsPerSecond: number
  }
  api: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
    activeConnections: number
  }
  external: {
    [serviceName: string]: {
      responseTime: number
      availability: number
      errorRate: number
    }
  }
}

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  source: string
  timestamp: string
  resolved: boolean
  resolvedAt?: string
  metadata?: Record<string, any>
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum AlertType {
  SYSTEM = 'system',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  BUSINESS = 'business'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface MonitoringConfig {
  healthChecks: {
    interval: number
    timeout: number
    retries: number
  }
  metrics: {
    collectionInterval: number
    retentionDays: number
  }
  alerts: {
    enabled: boolean
    channels: AlertChannel[]
    thresholds: AlertThresholds
  }
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms'
  config: Record<string, any>
  enabled: boolean
}

export interface AlertThresholds {
  cpu: number
  memory: number
  diskSpace: number
  responseTime: number
  errorRate: number
  databaseConnections: number
  queueSize: number
}

/**
 * System monitoring and health check manager
 */
export class SystemMonitor {
  private config: MonitoringConfig
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map()
  private metrics: PerformanceMetrics[] = []
  private alerts: Alert[] = []
  private startTime: number = Date.now()

  constructor(config: MonitoringConfig) {
    this.config = config
    this.registerDefaultHealthChecks()
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, check)
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<SystemHealth> {
    const checks: HealthCheck[] = []
    const startTime = Date.now()

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const checkStartTime = Date.now()
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheck>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), this.config.healthChecks.timeout)
          )
        ])
        
        result.duration = Date.now() - checkStartTime
        checks.push(result)
      } catch (error) {
        checks.push({
          name,
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Calculate overall system health
    const healthy = checks.filter(c => c.status === HealthStatus.HEALTHY).length
    const degraded = checks.filter(c => c.status === HealthStatus.DEGRADED).length
    const unhealthy = checks.filter(c => c.status === HealthStatus.UNHEALTHY).length

    let overallStatus = HealthStatus.HEALTHY
    if (unhealthy > 0) {
      overallStatus = HealthStatus.UNHEALTHY
    } else if (degraded > 0) {
      overallStatus = HealthStatus.DEGRADED
    }

    return {
      status: overallStatus,
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        total: checks.length,
        healthy,
        unhealthy,
        degraded
      }
    }
  }

  /**
   * Collect performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      cpu: await this.getCPUMetrics(),
      memory: await this.getMemoryMetrics(),
      database: await this.getDatabaseMetrics(),
      redis: await this.getRedisMetrics(),
      api: await this.getAPIMetrics(),
      external: await this.getExternalServiceMetrics()
    }

    // Store metrics (keep last 1000 entries)
    this.metrics.push(metrics)
    if (this.metrics.length > 1000) {
      this.metrics.shift()
    }

    // Check for alert conditions
    await this.checkAlertThresholds(metrics)

    return metrics
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000)
    return this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoff)
  }

  /**
   * Create an alert
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      source,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata
    }

    this.alerts.push(alert)

    // Send alert notifications
    if (this.config.alerts.enabled) {
      await this.sendAlertNotifications(alert)
    }

    return alert
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = new Date().toISOString()
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved)
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 100): Alert[] {
    return this.alerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  // Private methods

  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      try {
        // In a real implementation, you would check database connectivity
        // const result = await db.raw('SELECT 1')
        
        return {
          name: 'database',
          status: HealthStatus.HEALTHY,
          message: 'Database connection is healthy',
          timestamp: new Date().toISOString(),
          metadata: {
            connectionPool: {
              active: 5,
              idle: 10,
              total: 15
            }
          }
        }
      } catch (error) {
        return {
          name: 'database',
          status: HealthStatus.UNHEALTHY,
          message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Redis health check
    this.registerHealthCheck('redis', async () => {
      try {
        // In a real implementation, you would check Redis connectivity
        // await redis.ping()
        
        return {
          name: 'redis',
          status: HealthStatus.HEALTHY,
          message: 'Redis connection is healthy',
          timestamp: new Date().toISOString(),
          metadata: {
            memory: '10MB',
            connections: 5,
            keyspace: 1250
          }
        }
      } catch (error) {
        return {
          name: 'redis',
          status: HealthStatus.UNHEALTHY,
          message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString()
        }
      }
    })

    // External services health check
    this.registerHealthCheck('external_services', async () => {
      const services = ['openai', 'anthropic', 'sendgrid']
      const results = await Promise.allSettled(
        services.map(service => this.checkExternalService(service))
      )

      const failures = results.filter(r => r.status === 'rejected').length
      
      if (failures === 0) {
        return {
          name: 'external_services',
          status: HealthStatus.HEALTHY,
          message: 'All external services are healthy',
          timestamp: new Date().toISOString(),
          metadata: { services, failures: 0 }
        }
      } else if (failures < services.length) {
        return {
          name: 'external_services',
          status: HealthStatus.DEGRADED,
          message: `${failures} out of ${services.length} external services are unhealthy`,
          timestamp: new Date().toISOString(),
          metadata: { services, failures }
        }
      } else {
        return {
          name: 'external_services',
          status: HealthStatus.UNHEALTHY,
          message: 'All external services are unhealthy',
          timestamp: new Date().toISOString(),
          metadata: { services, failures }
        }
      }
    })

    // Disk space health check
    this.registerHealthCheck('disk_space', async () => {
      try {
        // In a real implementation, you would check actual disk usage
        const usage = Math.random() * 100 // Mock usage percentage
        
        if (usage > 90) {
          return {
            name: 'disk_space',
            status: HealthStatus.UNHEALTHY,
            message: `Disk usage is critically high: ${usage.toFixed(1)}%`,
            timestamp: new Date().toISOString(),
            metadata: { usage }
          }
        } else if (usage > 80) {
          return {
            name: 'disk_space',
            status: HealthStatus.DEGRADED,
            message: `Disk usage is high: ${usage.toFixed(1)}%`,
            timestamp: new Date().toISOString(),
            metadata: { usage }
          }
        } else {
          return {
            name: 'disk_space',
            status: HealthStatus.HEALTHY,
            message: `Disk usage is normal: ${usage.toFixed(1)}%`,
            timestamp: new Date().toISOString(),
            metadata: { usage }
          }
        }
      } catch (error) {
        return {
          name: 'disk_space',
          status: HealthStatus.UNKNOWN,
          message: 'Unable to check disk space',
          timestamp: new Date().toISOString()
        }
      }
    })
  }

  private async checkExternalService(serviceName: string): Promise<void> {
    // Mock external service check
    const isHealthy = Math.random() > 0.1 // 90% chance of being healthy
    
    if (!isHealthy) {
      throw new Error(`${serviceName} is not responding`)
    }
  }

  private async getCPUMetrics() {
    // In a real implementation, you would get actual CPU metrics
    return {
      usage: Math.random() * 100,
      loadAverage: [1.2, 1.5, 1.8]
    }
  }

  private async getMemoryMetrics() {
    // In a real implementation, you would get actual memory metrics
    const total = 8 * 1024 * 1024 * 1024 // 8GB
    const used = Math.random() * total
    
    return {
      used,
      total,
      percentage: (used / total) * 100,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal
    }
  }

  private async getDatabaseMetrics() {
    // Mock database metrics
    return {
      connections: {
        active: Math.floor(Math.random() * 20),
        idle: Math.floor(Math.random() * 30),
        total: 50
      },
      queryTime: {
        avg: Math.random() * 100,
        p95: Math.random() * 500,
        p99: Math.random() * 1000
      },
      slowQueries: Math.floor(Math.random() * 5)
    }
  }

  private async getRedisMetrics() {
    // Mock Redis metrics
    return {
      connections: Math.floor(Math.random() * 10),
      memory: Math.floor(Math.random() * 100) * 1024 * 1024, // MB
      keyspace: {
        keys: Math.floor(Math.random() * 10000),
        expires: Math.floor(Math.random() * 1000)
      },
      commandsPerSecond: Math.floor(Math.random() * 1000)
    }
  }

  private async getAPIMetrics() {
    // Mock API metrics
    return {
      requestsPerMinute: Math.floor(Math.random() * 1000),
      averageResponseTime: Math.random() * 500,
      errorRate: Math.random() * 5,
      activeConnections: Math.floor(Math.random() * 100)
    }
  }

  private async getExternalServiceMetrics() {
    const services = ['openai', 'anthropic', 'sendgrid', 'stripe']
    const metrics: Record<string, any> = {}
    
    for (const service of services) {
      metrics[service] = {
        responseTime: Math.random() * 1000,
        availability: 95 + Math.random() * 5,
        errorRate: Math.random() * 2
      }
    }
    
    return metrics
  }

  private async checkAlertThresholds(metrics: PerformanceMetrics): Promise<void> {
    const thresholds = this.config.alerts.thresholds

    // CPU usage alert
    if (metrics.cpu.usage > thresholds.cpu) {
      await this.createAlert(
        AlertType.PERFORMANCE,
        AlertSeverity.WARNING,
        'High CPU Usage',
        `CPU usage is ${metrics.cpu.usage.toFixed(1)}%, exceeding threshold of ${thresholds.cpu}%`,
        'system_monitor',
        { cpuUsage: metrics.cpu.usage, threshold: thresholds.cpu }
      )
    }

    // Memory usage alert
    if (metrics.memory.percentage > thresholds.memory) {
      await this.createAlert(
        AlertType.PERFORMANCE,
        AlertSeverity.WARNING,
        'High Memory Usage',
        `Memory usage is ${metrics.memory.percentage.toFixed(1)}%, exceeding threshold of ${thresholds.memory}%`,
        'system_monitor',
        { memoryUsage: metrics.memory.percentage, threshold: thresholds.memory }
      )
    }

    // Response time alert
    if (metrics.api.averageResponseTime > thresholds.responseTime) {
      await this.createAlert(
        AlertType.PERFORMANCE,
        AlertSeverity.WARNING,
        'High Response Time',
        `Average response time is ${metrics.api.averageResponseTime.toFixed(0)}ms, exceeding threshold of ${thresholds.responseTime}ms`,
        'system_monitor',
        { responseTime: metrics.api.averageResponseTime, threshold: thresholds.responseTime }
      )
    }

    // Error rate alert
    if (metrics.api.errorRate > thresholds.errorRate) {
      await this.createAlert(
        AlertType.PERFORMANCE,
        AlertSeverity.ERROR,
        'High Error Rate',
        `API error rate is ${metrics.api.errorRate.toFixed(1)}%, exceeding threshold of ${thresholds.errorRate}%`,
        'system_monitor',
        { errorRate: metrics.api.errorRate, threshold: thresholds.errorRate }
      )
    }
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    for (const channel of this.config.alerts.channels) {
      if (!channel.enabled) continue

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(alert, channel.config)
            break
          case 'slack':
            await this.sendSlackAlert(alert, channel.config)
            break
          case 'webhook':
            await this.sendWebhookAlert(alert, channel.config)
            break
          case 'sms':
            await this.sendSMSAlert(alert, channel.config)
            break
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error)
      }
    }
  }

  private async sendEmailAlert(alert: Alert, config: any): Promise<void> {
    // In a real implementation, you would send an email
    console.log('Email alert:', { alert, config })
  }

  private async sendSlackAlert(alert: Alert, config: any): Promise<void> {
    // In a real implementation, you would send to Slack
    console.log('Slack alert:', { alert, config })
  }

  private async sendWebhookAlert(alert: Alert, config: any): Promise<void> {
    // In a real implementation, you would send to webhook
    console.log('Webhook alert:', { alert, config })
  }

  private async sendSMSAlert(alert: Alert, config: any): Promise<void> {
    // In a real implementation, you would send SMS
    console.log('SMS alert:', { alert, config })
  }
}

// Default monitoring configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
    retries: 3
  },
  metrics: {
    collectionInterval: 60000, // 1 minute
    retentionDays: 7
  },
  alerts: {
    enabled: true,
    channels: [
      {
        type: 'email',
        config: {
          to: ['admin@coldreachpro.com'],
          from: 'alerts@coldreachpro.com'
        },
        enabled: true
      }
    ],
    thresholds: {
      cpu: 80,
      memory: 85,
      diskSpace: 90,
      responseTime: 2000,
      errorRate: 5,
      databaseConnections: 80,
      queueSize: 1000
    }
  }
}

// Export singleton instance
export const systemMonitor = new SystemMonitor(defaultMonitoringConfig)

// Validation schemas
export const healthCheckSchema = z.object({
  name: z.string(),
  status: z.nativeEnum(HealthStatus),
  message: z.string().optional(),
  duration: z.number().optional(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional()
})

export const alertSchema = z.object({
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  source: z.string().min(1).max(100),
  metadata: z.record(z.any()).optional()
})