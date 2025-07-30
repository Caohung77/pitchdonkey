import { NextRequest, NextResponse } from 'next/server'
import { systemMonitor, AlertType, AlertSeverity, alertSchema } from '@/lib/monitoring'
import { asyncHandler, handleAuthError, handleValidationError } from '@/lib/middleware/error-middleware'
import { createClient } from '@/lib/supabase'

/**
 * Get alerts
 * GET /api/monitoring/alerts
 */
export const GET = asyncHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    handleAuthError('Authentication required to access alerts')
  }

  const url = new URL(request.url)
  const activeOnly = url.searchParams.get('active') === 'true'
  const limit = parseInt(url.searchParams.get('limit') || '100')
  const severity = url.searchParams.get('severity') as AlertSeverity | null
  const type = url.searchParams.get('type') as AlertType | null

  let alerts = activeOnly ? systemMonitor.getActiveAlerts() : systemMonitor.getAllAlerts(limit)

  // Filter by severity if specified
  if (severity && Object.values(AlertSeverity).includes(severity)) {
    alerts = alerts.filter(alert => alert.severity === severity)
  }

  // Filter by type if specified
  if (type && Object.values(AlertType).includes(type)) {
    alerts = alerts.filter(alert => alert.type === type)
  }

  return NextResponse.json({
    count: alerts.length,
    alerts
  })
})

/**
 * Create alert
 * POST /api/monitoring/alerts
 */
export const POST = asyncHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    handleAuthError('Authentication required to create alerts')
  }

  const body = await request.json()
  
  // Validate request body
  const validation = alertSchema.safeParse(body)
  if (!validation.success) {
    handleValidationError(validation, 'Invalid alert data')
  }

  const { type, severity, title, message, source, metadata } = validation.data

  const alert = await systemMonitor.createAlert(
    type,
    severity,
    title,
    message,
    source || 'manual',
    metadata
  )

  return NextResponse.json(alert, { status: 201 })
})

/**
 * Resolve alert
 * PATCH /api/monitoring/alerts/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return asyncHandler(async () => {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      handleAuthError('Authentication required to resolve alerts')
    }

    const alertId = params.id
    const body = await request.json()

    if (body.action === 'resolve') {
      await systemMonitor.resolveAlert(alertId)
      
      return NextResponse.json({
        message: 'Alert resolved successfully',
        alertId
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Only "resolve" is supported.' },
      { status: 400 }
    )
  })(request)
}