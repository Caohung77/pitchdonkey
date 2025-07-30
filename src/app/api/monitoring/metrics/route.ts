import { NextRequest, NextResponse } from 'next/server'
import { systemMonitor } from '@/lib/monitoring'
import { asyncHandler, handleAuthError } from '@/lib/middleware/error-middleware'
import { createClient } from '@/lib/supabase'

/**
 * Get performance metrics
 * GET /api/monitoring/metrics
 */
export const GET = asyncHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication - only allow authenticated users
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    handleAuthError('Authentication required to access metrics')
  }

  // TODO: Add admin role check
  // For now, allow any authenticated user

  const url = new URL(request.url)
  const minutes = parseInt(url.searchParams.get('minutes') || '60')
  const current = url.searchParams.get('current') === 'true'

  if (current) {
    // Get current metrics
    const metrics = await systemMonitor.collectMetrics()
    return NextResponse.json(metrics)
  } else {
    // Get historical metrics
    const metrics = systemMonitor.getRecentMetrics(minutes)
    return NextResponse.json({
      timeRange: `${minutes} minutes`,
      count: metrics.length,
      metrics
    })
  }
})

/**
 * Trigger metrics collection
 * POST /api/monitoring/metrics
 */
export const POST = asyncHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    handleAuthError('Authentication required to trigger metrics collection')
  }

  const metrics = await systemMonitor.collectMetrics()
  
  return NextResponse.json({
    message: 'Metrics collected successfully',
    timestamp: metrics.timestamp,
    metrics
  })
})