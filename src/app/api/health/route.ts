import { NextRequest, NextResponse } from 'next/server'
import { systemMonitor } from '@/lib/monitoring'
import { asyncHandler } from '@/lib/middleware/error-middleware'

/**
 * Health check endpoint
 * GET /api/health
 */
export const GET = asyncHandler(async (request: NextRequest) => {
  const health = await systemMonitor.runHealthChecks()
  
  // Return appropriate HTTP status based on health
  let status = 200
  switch (health.status) {
    case 'unhealthy':
      status = 503 // Service Unavailable
      break
    case 'degraded':
      status = 200 // OK but with warnings
      break
    case 'healthy':
    default:
      status = 200
      break
  }

  return NextResponse.json(health, { 
    status,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})

/**
 * Simple liveness probe
 * GET /api/health?probe=liveness
 */
async function handleLivenessProbe(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}

/**
 * Readiness probe with basic checks
 * GET /api/health?probe=readiness
 */
async function handleReadinessProbe(): Promise<NextResponse> {
  try {
    // Run minimal health checks for readiness
    const health = await systemMonitor.runHealthChecks()
    
    // Consider ready if not completely unhealthy
    const isReady = health.status !== 'unhealthy'
    
    return NextResponse.json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: health.checks.map(check => ({
        name: check.name,
        status: check.status
      }))
    }, {
      status: isReady ? 200 : 503
    })
  } catch (error) {
    return NextResponse.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, {
      status: 503
    })
  }
}