import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'

/**
 * Debug Campaign Bulk Sending Issues
 * Provides detailed analysis of why campaigns stop sending after first batch
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()

  try {
    console.log('🔍 Starting campaign bulk send debugging...')

    // Get campaigns with sending status
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        daily_send_limit, total_contacts,
        first_batch_sent_at, current_batch_number,
        next_batch_send_time, emails_sent,
        contact_list_ids
      `)
      .eq('user_id', user.id)
      .in('status', ['sending', 'scheduled'])
      .order('created_at', { ascending: false })

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
    }

    const results = []

    for (const campaign of campaigns || []) {
      console.log(`📊 Analyzing campaign: ${campaign.name}`)

      // Get contact count from lists
      let totalContactsInLists = 0
      if (campaign.contact_list_ids?.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids, name')
          .in('id', campaign.contact_list_ids)

        contactLists?.forEach(list => {
          totalContactsInLists += list.contact_ids?.length || 0
        })
      }

      // Get email tracking
      const { data: emailTracking } = await supabase
        .from('email_tracking')
        .select('status, sent_at, created_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })

      const statusCounts = {}
      let sentToday = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      emailTracking?.forEach(record => {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1
        if (record.sent_at && new Date(record.sent_at) >= today) {
          sentToday++
        }
      })

      // Analyze batch timing
      let batchAnalysis = null
      if (campaign.next_batch_send_time) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const now = new Date()
        const timeUntilNext = nextBatchTime.getTime() - now.getTime()
        const hoursUntilNext = timeUntilNext / (1000 * 60 * 60)

        batchAnalysis = {
          nextBatchScheduled: nextBatchTime.toISOString(),
          currentTime: now.toISOString(),
          hoursUntilNext: parseFloat(hoursUntilNext.toFixed(2)),
          canSendNow: timeUntilNext <= 5 * 60 * 1000,
          timeWindow: '5 minutes'
        }
      }

      // Identify issues
      const issues = []

      if (totalContactsInLists > (campaign.daily_send_limit || 5)) {
        const batchesNeeded = Math.ceil(totalContactsInLists / (campaign.daily_send_limit || 5))
        issues.push(`Need ${batchesNeeded} batches for ${totalContactsInLists} contacts`)
      }

      if (campaign.first_batch_sent_at && !campaign.next_batch_send_time) {
        issues.push('CRITICAL: Missing next_batch_send_time')
      }

      const sentCount = emailTracking?.filter(e => e.sent_at)?.length || 0
      if (sentCount > 0 && sentCount < totalContactsInLists) {
        const lastSentEmail = emailTracking
          ?.filter(e => e.sent_at)
          ?.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0]

        if (lastSentEmail) {
          const hoursSinceLastSend = (new Date().getTime() - new Date(lastSentEmail.sent_at).getTime()) / (1000 * 60 * 60)
          if (hoursSinceLastSend > 25) {
            issues.push(`Last email sent ${hoursSinceLastSend.toFixed(1)} hours ago - processor may be stuck`)
          }
        }
      }

      results.push({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          dailyLimit: campaign.daily_send_limit || 5,
          currentBatchNumber: campaign.current_batch_number || 0
        },
        contacts: {
          totalInLists: totalContactsInLists,
          totalSent: sentCount,
          sentToday,
          remaining: Math.max(0, totalContactsInLists - sentCount)
        },
        timing: {
          firstBatchSent: campaign.first_batch_sent_at,
          nextBatchTime: campaign.next_batch_send_time,
          batchAnalysis
        },
        emailStatus: statusCounts,
        issues,
        recommendations: generateRecommendations(campaign, issues, batchAnalysis)
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      campaignsAnalyzed: results.length,
      results
    })

  } catch (error) {
    console.error('❌ Error in campaign debugging:', error)
    return NextResponse.json({
      error: 'Campaign debugging failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

function generateRecommendations(campaign: any, issues: string[], batchAnalysis: any): string[] {
  const recommendations = []

  if (issues.includes('CRITICAL: Missing next_batch_send_time')) {
    recommendations.push('Call POST /api/campaigns/fix-stuck-campaigns to repair batch timing')
  }

  if (batchAnalysis?.canSendNow) {
    recommendations.push('Campaign ready to send - trigger POST /api/campaigns/process')
  } else if (batchAnalysis?.hoursUntilNext > 0) {
    recommendations.push(`Wait ${Math.ceil(batchAnalysis.hoursUntilNext)} hours for next batch or manually fix timing`)
  }

  if (issues.some(issue => issue.includes('processor may be stuck'))) {
    recommendations.push('Check if campaign processor is running: GET /api/campaigns/processor')
  }

  return recommendations
}