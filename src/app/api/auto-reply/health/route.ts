import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSecurityHeaders } from '@/lib/auth-middleware'

/**
 * GET /api/auto-reply/health
 * Comprehensive health check for the auto-reply system
 *
 * Checks:
 * - Unclassified emails (should be processed within 5-10 minutes)
 * - Stuck emails (unclassified >10 minutes is BAD)
 * - Pending reply jobs ready to send
 * - Overdue reply jobs (not sent on time)
 * - Agent assignments
 *
 * No authentication required - health checks should be publicly accessible
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // 1. Check unclassified emails
    const { data: unclassifiedEmails } = await supabase
      .from('incoming_emails')
      .select('id, date_received, from_address, subject, user_id')
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')
      .order('date_received', { ascending: true })

    // Emails older than 10 minutes are considered "stuck"
    const now = Date.now()
    const stuckEmails = (unclassifiedEmails || []).filter(e =>
      (now - new Date(e.date_received).getTime()) > 10 * 60 * 1000
    )

    const stuckEmailDetails = stuckEmails.map(e => ({
      id: e.id,
      from: e.from_address,
      subject: e.subject,
      ageMinutes: Math.floor((now - new Date(e.date_received).getTime()) / (60 * 1000)),
      receivedAt: e.date_received
    }))

    // 2. Check pending reply jobs
    const { data: pendingJobs } = await supabase
      .from('reply_jobs')
      .select('id, scheduled_at, recipient_email, draft_subject')
      .in('status', ['scheduled', 'approved'])
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })

    // Jobs overdue by more than 5 minutes
    const overdueJobs = (pendingJobs || []).filter(j =>
      (now - new Date(j.scheduled_at).getTime()) > 5 * 60 * 1000
    )

    const overdueJobDetails = overdueJobs.map(j => ({
      id: j.id,
      to: j.recipient_email,
      subject: j.draft_subject,
      scheduledAt: j.scheduled_at,
      overdueMinutes: Math.floor((now - new Date(j.scheduled_at).getTime()) / (60 * 1000))
    }))

    // 3. Check agent assignments
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id, email, assigned_agent_id:assigned_persona_id, provider')

    const accountsWithAgents = emailAccounts?.filter(a => a.assigned_agent_id) || []
    const accountsWithoutAgents = emailAccounts?.filter(a => !a.assigned_agent_id) || []

    // 4. Get active agents
    const { data: activeAgents } = await supabase
      .from('ai_personas' as any)
      .select('id, name, status')
      .eq('status', 'active')

    // 5. Check recent classification success rate (last hour)
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString()
    const { data: recentEmails } = await supabase
      .from('incoming_emails')
      .select('id, classification_status, date_received')
      .gte('date_received', oneHourAgo)

    const classifiedCount = recentEmails?.filter(e => e.classification_status !== 'unclassified').length || 0
    const totalRecentCount = recentEmails?.length || 0
    const classificationRate = totalRecentCount > 0 ? (classifiedCount / totalRecentCount) * 100 : 100

    // 6. Check recent reply job creation (last hour)
    const { data: recentReplyJobs } = await supabase
      .from('reply_jobs')
      .select('id, status, created_at')
      .gte('created_at', oneHourAgo)

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy'
    const issues: string[] = []

    if (stuckEmails.length > 0) {
      issues.push(`${stuckEmails.length} emails stuck unclassified >10 min`)
    }

    if (overdueJobs.length > 5) {
      issues.push(`${overdueJobs.length} reply jobs overdue >5 min`)
    }

    if (classificationRate < 80 && totalRecentCount > 10) {
      issues.push(`Low classification rate: ${classificationRate.toFixed(1)}%`)
    }

    if (accountsWithAgents.length === 0) {
      issues.push('No agents assigned to any email accounts')
    }

    if (activeAgents?.length === 0) {
      issues.push('No active outreach agents')
    }

    if (issues.length === 0) {
      status = 'healthy'
    } else if (stuckEmails.length > 10 || overdueJobs.length > 10) {
      status = 'unhealthy'
    } else {
      status = 'degraded'
    }

    const health = {
      status,
      timestamp: new Date().toISOString(),
      issues: issues.length > 0 ? issues : null,

      unclassifiedEmails: {
        total: unclassifiedEmails?.length || 0,
        stuck: stuckEmails.length,
        stuckDetails: stuckEmailDetails.slice(0, 10), // Show first 10
        alert: stuckEmails.length > 0
          ? `⚠️ ${stuckEmails.length} emails unclassified for >10 minutes - check cron jobs`
          : null
      },

      pendingReplies: {
        total: pendingJobs?.length || 0,
        readyToSend: pendingJobs?.length || 0,
        overdue: overdueJobs.length,
        overdueDetails: overdueJobDetails.slice(0, 10), // Show first 10
        alert: overdueJobs.length > 5
          ? `⚠️ ${overdueJobs.length} reply jobs overdue - check process-reply-jobs cron`
          : null
      },

      agents: {
        totalActive: activeAgents?.length || 0,
        accountsWithAgents: accountsWithAgents.length,
        accountsWithoutAgents: accountsWithoutAgents.length,
        totalAccounts: emailAccounts?.length || 0,
        alert: accountsWithAgents.length === 0
          ? '⚠️ No agents assigned to email accounts - auto-replies will not be created'
          : null
      },

      performance: {
        lastHour: {
          emailsReceived: totalRecentCount,
          emailsClassified: classifiedCount,
          classificationRate: `${classificationRate.toFixed(1)}%`,
          replyJobsCreated: recentReplyJobs?.length || 0
        }
      },

      recommendations: status === 'healthy' ? null : [
        stuckEmails.length > 0 ? 'Check /api/cron/fetch-emails and /api/cron/classify-emails logs' : null,
        overdueJobs.length > 0 ? 'Check /api/cron/process-reply-jobs logs' : null,
        accountsWithAgents.length === 0 ? 'Assign outreach agents to email accounts in Dashboard' : null,
        activeAgents?.length === 0 ? 'Create and activate an outreach agent in Dashboard' : null
      ].filter(Boolean)
    }

    const response = NextResponse.json(health)
    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in auto-reply health check:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
