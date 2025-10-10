import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSecurityHeaders } from '@/lib/auth-middleware'
import { ReplyProcessor } from '@/lib/reply-processor'

// Configure function to run up to 60 seconds (Vercel limit)
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/classify-emails
 * Fallback cron job to process unclassified emails
 *
 * This is a safety net that runs every 5 minutes to catch emails that weren't
 * classified during the initial fetch-emails sync (e.g., due to timeout or errors).
 *
 * This ensures NO email sits unclassified for more than 5 minutes.
 *
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Cron: Classify emails fallback triggered')

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - invalid or missing CRON_SECRET')
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Find all users with unclassified emails
    const { data: unclassifiedEmails, error: queryError } = await supabase
      .from('incoming_emails')
      .select('user_id, id, date_received, from_address, subject')
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')
      .order('date_received', { ascending: true })
      .limit(500) // Process up to 500 emails per run

    if (queryError) {
      throw new Error(`Failed to fetch unclassified emails: ${queryError.message}`)
    }

    if (!unclassifiedEmails || unclassifiedEmails.length === 0) {
      console.log('✅ No unclassified emails to process')
      return NextResponse.json({
        success: true,
        message: 'No unclassified emails found',
        totalUnclassified: 0,
        totalUsers: 0,
        results: []
      })
    }

    // Group by user_id
    const uniqueUserIds = [...new Set(unclassifiedEmails.map(e => e.user_id))]
    const emailsByUser = unclassifiedEmails.reduce((acc, email) => {
      if (!acc[email.user_id]) {
        acc[email.user_id] = []
      }
      acc[email.user_id].push(email)
      return acc
    }, {} as Record<string, any[]>)

    console.log(`📧 Found ${unclassifiedEmails.length} unclassified emails from ${uniqueUserIds.length} users`)

    // Check for stuck emails (older than 10 minutes)
    const stuckEmails = unclassifiedEmails.filter(e => {
      const ageMinutes = (Date.now() - new Date(e.date_received).getTime()) / (60 * 1000)
      return ageMinutes > 10
    })

    if (stuckEmails.length > 0) {
      console.warn(`⚠️ Found ${stuckEmails.length} stuck emails (>10 min old):`)
      stuckEmails.slice(0, 5).forEach(e => {
        const ageMinutes = Math.floor((Date.now() - new Date(e.date_received).getTime()) / (60 * 1000))
        console.warn(`  - ${e.from_address} - "${e.subject}" (${ageMinutes} min old)`)
      })
    }

    const results = []
    let totalProcessed = 0
    let totalSuccessful = 0
    let totalFailed = 0
    let totalDraftsCreated = 0

    // Process each user's emails
    for (const userId of uniqueUserIds) {
      const userEmails = emailsByUser[userId]

      try {
        const replyProcessor = new ReplyProcessor()
        const result = await replyProcessor.processUnclassifiedEmails(userId, userEmails.length)

        totalProcessed += result.processed
        totalSuccessful += result.successful
        totalFailed += result.failed
        totalDraftsCreated += (result.autonomousDraftsCreated || 0)

        results.push({
          userId,
          emailCount: userEmails.length,
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          autonomousDrafts: result.autonomousDraftsCreated || 0,
          errors: result.errors.length > 0 ? result.errors.slice(0, 3) : []
        })

        console.log(`✅ User ${userId}: ${result.successful}/${result.processed} emails classified (${result.autonomousDraftsCreated || 0} auto-drafts)`)

      } catch (error) {
        totalFailed += userEmails.length

        results.push({
          userId,
          emailCount: userEmails.length,
          error: error.message
        })

        console.error(`❌ Error processing user ${userId}:`, error)
      }
    }

    const summary = {
      totalUnclassified: unclassifiedEmails.length,
      totalUsers: uniqueUserIds.length,
      totalProcessed,
      totalSuccessful,
      totalFailed,
      totalDraftsCreated,
      stuckEmailsCount: stuckEmails.length
    }

    console.log(`✅ Fallback classification completed: ${totalSuccessful}/${totalProcessed} emails (${totalDraftsCreated} auto-drafts created)`)

    if (stuckEmails.length > 0) {
      console.warn(`⚠️ ${stuckEmails.length} emails were stuck >10 min - this indicates a problem with the main sync`)
    }

    const response = NextResponse.json({
      success: true,
      message: `Classified ${totalSuccessful}/${totalProcessed} emails from ${uniqueUserIds.length} users`,
      data: {
        ...summary,
        results
      },
      timestamp: new Date().toISOString()
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('❌ Cron: Error in fallback classification:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/classify-emails
 * Health check for fallback classification endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Count unclassified emails
    const { data: unclassified, error } = await supabase
      .from('incoming_emails')
      .select('id, date_received')
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')

    if (error) {
      console.error('Error fetching unclassified email stats:', error)
    }

    // Count stuck emails (>10 min old)
    const stuckEmails = unclassified?.filter(e =>
      (Date.now() - new Date(e.date_received).getTime()) > 10 * 60 * 1000
    ) || []

    const response = NextResponse.json({
      status: stuckEmails.length === 0 ? 'healthy' : 'degraded',
      endpoint: '/api/cron/classify-emails',
      stats: {
        total_unclassified: unclassified?.length || 0,
        stuck_emails: stuckEmails.length,
        alert: stuckEmails.length > 0 ? 'Emails stuck unclassified >10 minutes - check main sync' : null
      },
      timestamp: new Date().toISOString(),
      cron_secret_configured: !!cronSecret
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in classification health check:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
