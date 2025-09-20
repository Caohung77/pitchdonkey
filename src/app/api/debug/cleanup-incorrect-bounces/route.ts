import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * Data Cleanup Script: Fix Incorrect Bounce Data
 *
 * This script fixes the critical issue where emails are marked as "bounced"
 * even though they were never actually sent. This causes incorrect analytics
 * showing "bounced emails that were never sent".
 *
 * The fix:
 * 1. Find emails with bounce data (bounced_at/bounce_reason) but no sent_at timestamp
 * 2. Clear the bounce data since these are send failures, not bounces
 * 3. Ensure the status is correctly set to "failed"
 * 4. Update campaign statistics to reflect accurate counts
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  console.log('🧹 === CLEANUP: INCORRECT BOUNCE DATA ===')

  try {
    // Step 1: Find all incorrect bounce records
    console.log('\n📋 Step 1: Finding incorrect bounce records...')

    const { data: incorrectBounces, error: fetchError } = await supabase
      .from('email_tracking')
      .select('id, campaign_id, contact_id, status, sent_at, bounced_at, bounce_reason, message_id')
      .or('bounced_at.not.is.null,bounce_reason.not.is.null')
      .is('sent_at', null)

    if (fetchError) {
      throw new Error(`Failed to find incorrect bounces: ${fetchError.message}`)
    }

    console.log(`📊 Found ${incorrectBounces?.length || 0} incorrect bounce records`)

    if (!incorrectBounces || incorrectBounces.length === 0) {
      return Response.json({
        success: true,
        message: 'No incorrect bounce records found - data is clean!',
        timestamp: new Date().toISOString(),
        details: {
          incorrectBouncesFound: 0,
          recordsCleaned: 0,
          campaignsUpdated: 0
        }
      })
    }

    // Group by campaign for efficient updates
    const campaignGroups = new Map()
    incorrectBounces.forEach(record => {
      if (!campaignGroups.has(record.campaign_id)) {
        campaignGroups.set(record.campaign_id, [])
      }
      campaignGroups.get(record.campaign_id).push(record)
    })

    console.log(`📊 Found incorrect bounces in ${campaignGroups.size} campaigns`)

    // Step 2: Fix the incorrect bounce records
    console.log('\n🔧 Step 2: Cleaning up incorrect bounce records...')

    const cleanupResults = []
    let totalCleaned = 0

    for (const [campaignId, records] of campaignGroups) {
      try {
        console.log(`\n🎯 Cleaning campaign ${campaignId}: ${records.length} incorrect records`)

        // Extract record IDs for this campaign
        const recordIds = records.map(r => r.id)

        // Clear bounce data for these records
        const { error: updateError } = await supabase
          .from('email_tracking')
          .update({
            bounced_at: null,
            bounce_reason: null,
            status: 'failed' // Ensure correct status for send failures
          })
          .in('id', recordIds)

        if (updateError) {
          console.error(`❌ Failed to clean records for campaign ${campaignId}:`, updateError)
          cleanupResults.push({
            campaignId,
            success: false,
            error: updateError.message,
            recordsAttempted: records.length
          })
          continue
        }

        totalCleaned += records.length
        console.log(`✅ Cleaned ${records.length} records for campaign ${campaignId}`)

        cleanupResults.push({
          campaignId,
          success: true,
          recordsCleaned: records.length,
          recordIds: recordIds.slice(0, 5) // Show first 5 IDs for verification
        })

      } catch (error) {
        console.error(`❌ Error cleaning campaign ${campaignId}:`, error)
        cleanupResults.push({
          campaignId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsAttempted: records.length
        })
      }
    }

    // Step 3: Update campaign statistics
    console.log('\n📊 Step 3: Updating campaign statistics...')

    const campaignUpdates = []

    for (const campaignId of campaignGroups.keys()) {
      try {
        // Get accurate email counts for this campaign
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at, status, bounced_at, bounce_reason')
          .eq('campaign_id', campaignId)

        if (!emailStats) continue

        // Calculate accurate counts using the fixed logic
        const sentEmails = emailStats.filter(e => e.sent_at !== null).length
        const failedEmails = emailStats.filter(e => e.status === 'failed' && !e.sent_at).length
        const actualBounces = emailStats.filter(e =>
          e.sent_at !== null && (e.bounced_at !== null || e.bounce_reason !== null)
        ).length

        // Update campaign with accurate statistics
        const { error: campaignUpdateError } = await supabase
          .from('campaigns')
          .update({
            emails_sent: sentEmails,
            emails_bounced: actualBounces, // Only actual bounces, not send failures
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)

        if (campaignUpdateError) {
          console.error(`❌ Failed to update campaign ${campaignId} statistics:`, campaignUpdateError)
          campaignUpdates.push({
            campaignId,
            success: false,
            error: campaignUpdateError.message
          })
        } else {
          console.log(`✅ Updated campaign ${campaignId}: ${sentEmails} sent, ${actualBounces} bounced, ${failedEmails} failed`)
          campaignUpdates.push({
            campaignId,
            success: true,
            emailsSent: sentEmails,
            emailsBounced: actualBounces,
            emailsFailed: failedEmails
          })
        }

      } catch (error) {
        console.error(`❌ Error updating campaign ${campaignId}:`, error)
        campaignUpdates.push({
          campaignId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Step 4: Verification
    console.log('\n✅ Step 4: Verification...')

    const { data: remainingIncorrectBounces } = await supabase
      .from('email_tracking')
      .select('id')
      .or('bounced_at.not.is.null,bounce_reason.not.is.null')
      .is('sent_at', null)

    const remainingCount = remainingIncorrectBounces?.length || 0

    console.log(`📊 Verification: ${remainingCount} incorrect bounce records remaining`)

    // Generate summary
    const successfulCleanups = cleanupResults.filter(r => r.success).length
    const failedCleanups = cleanupResults.filter(r => !r.success).length
    const successfulCampaignUpdates = campaignUpdates.filter(r => r.success).length

    console.log('🎉 === CLEANUP COMPLETED ===')
    console.log(`✅ Successfully cleaned: ${totalCleaned} records`)
    console.log(`📊 Campaigns cleaned: ${successfulCleanups}/${campaignGroups.size}`)
    console.log(`📊 Campaign stats updated: ${successfulCampaignUpdates}/${campaignGroups.size}`)

    return Response.json({
      success: true,
      message: `Successfully cleaned ${totalCleaned} incorrect bounce records`,
      timestamp: new Date().toISOString(),
      details: {
        incorrectBouncesFound: incorrectBounces.length,
        recordsCleaned: totalCleaned,
        campaignsProcessed: campaignGroups.size,
        successfulCleanups,
        failedCleanups,
        remainingIncorrectBounces: remainingCount,
        verification: remainingCount === 0 ? 'PASSED' : 'FAILED'
      },
      results: {
        cleanupResults,
        campaignUpdates
      },
      recommendations: remainingCount > 0 ? [
        'Some incorrect bounce records remain. Check the failed cleanups and retry.',
        'Verify that the email_tracking table has the correct permissions.',
        'Consider running this cleanup script again.'
      ] : [
        '✅ All incorrect bounce data has been cleaned!',
        '✅ Campaign statistics have been updated with accurate counts.',
        '✅ Analytics should now show realistic data only.'
      ]
    })

  } catch (error) {
    console.error('💥 Critical error in bounce data cleanup:', error)

    return Response.json({
      success: false,
      error: 'Bounce data cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST endpoint for manual cleanup execution
 */
export async function POST(request: NextRequest) {
  console.log('🚀 Manual trigger of bounce data cleanup')

  // Call the same logic as GET
  return GET(request)
}