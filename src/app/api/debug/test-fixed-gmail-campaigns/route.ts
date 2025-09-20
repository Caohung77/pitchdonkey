import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { fixedCampaignProcessor } from '@/lib/campaign-processor-fixed'

/**
 * Test endpoint for the Fixed Gmail Campaign Processor
 * Tests the complete flow: detection → execution → tracking → analytics
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  console.log('🧪 === TESTING FIXED GMAIL CAMPAIGN PROCESSOR ===')

  try {
    // Step 1: Find Gmail campaigns ready for testing
    console.log('\n📋 Step 1: Finding Gmail campaigns for testing...')

    const { data: gmailCampaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts!inner(
          id,
          email,
          provider,
          status,
          access_token,
          refresh_token
        )
      `)
      .in('status', ['scheduled', 'sending'])
      .or('provider.eq.gmail,provider.eq.gmail-imap-smtp,provider.eq.google', { foreignTable: 'email_accounts' })
      .eq('email_accounts.status', 'active')
      .limit(5)

    if (campaignError) {
      throw new Error(`Failed to find Gmail campaigns: ${campaignError.message}`)
    }

    console.log(`📊 Found ${gmailCampaigns?.length || 0} Gmail campaigns ready for testing`)

    if (!gmailCampaigns || gmailCampaigns.length === 0) {
      return Response.json({
        success: true,
        message: 'No Gmail campaigns found for testing',
        recommendations: [
          'Create a Gmail campaign with status "scheduled" or "sending"',
          'Ensure the Gmail email account is active and has OAuth tokens',
          'Check that the scheduled_date is in the past for immediate processing'
        ]
      })
    }

    // Step 2: Test Gmail provider detection
    console.log('\n🔍 Step 2: Testing Gmail provider detection...')
    const gmailProviderTests = gmailCampaigns.map(campaign => {
      const provider = campaign.email_accounts.provider
      const isGmailDetected = ['gmail', 'gmail-imap-smtp', 'google', 'gmail-oauth'].includes(provider.toLowerCase())

      console.log(`  Campaign: ${campaign.name} - Provider: ${provider} - Detected as Gmail: ${isGmailDetected}`)

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        provider: provider,
        gmailDetected: isGmailDetected,
        hasTokens: !!(campaign.email_accounts.access_token && campaign.email_accounts.refresh_token)
      }
    })

    // Step 3: Test campaign processing
    console.log('\n⚡ Step 3: Testing Fixed Campaign Processor...')

    const processingResults = []

    // Process one campaign for testing
    const testCampaign = gmailCampaigns[0]
    console.log(`\n🎯 Testing campaign: ${testCampaign.name} (${testCampaign.id})`)

    try {
      // Get email tracking before processing
      const { data: emailTrackingBefore } = await supabase
        .from('email_tracking')
        .select('id, status, sent_at, bounced_at, bounce_reason')
        .eq('campaign_id', testCampaign.id)

      console.log(`📊 Email tracking before: ${emailTrackingBefore?.length || 0} records`)

      // Run the fixed processor
      await fixedCampaignProcessor.processReadyCampaigns()

      // Get email tracking after processing
      const { data: emailTrackingAfter } = await supabase
        .from('email_tracking')
        .select('id, status, sent_at, bounced_at, bounce_reason')
        .eq('campaign_id', testCampaign.id)

      console.log(`📊 Email tracking after: ${emailTrackingAfter?.length || 0} records`)

      // Analyze results
      const sentEmails = emailTrackingAfter?.filter(e => e.sent_at !== null).length || 0
      const failedEmails = emailTrackingAfter?.filter(e => e.status === 'failed' && !e.sent_at).length || 0
      const bounced = emailTrackingAfter?.filter(e => e.bounced_at !== null && e.sent_at !== null).length || 0
      const incorrectBounces = emailTrackingAfter?.filter(e => e.bounced_at !== null && !e.sent_at).length || 0

      processingResults.push({
        campaignId: testCampaign.id,
        campaignName: testCampaign.name,
        success: true,
        beforeCount: emailTrackingBefore?.length || 0,
        afterCount: emailTrackingAfter?.length || 0,
        sentEmails,
        failedEmails,
        bouncedEmails: bounced,
        incorrectBounces, // This should be 0 in the fixed system
        healthCheck: {
          noIncorrectBounces: incorrectBounces === 0,
          hasEmailRecords: (emailTrackingAfter?.length || 0) > 0
        }
      })

    } catch (processingError) {
      console.error(`❌ Error processing campaign ${testCampaign.name}:`, processingError)
      processingResults.push({
        campaignId: testCampaign.id,
        campaignName: testCampaign.name,
        success: false,
        error: processingError instanceof Error ? processingError.message : 'Unknown error'
      })
    }

    // Step 4: Test analytics accuracy
    console.log('\n📊 Step 4: Testing analytics accuracy...')

    const analyticsTests = []

    for (const campaign of gmailCampaigns.slice(0, 3)) {
      try {
        // Get raw email tracking data
        const { data: emailTracking } = await supabase
          .from('email_tracking')
          .select('*')
          .eq('campaign_id', campaign.id)

        if (!emailTracking || emailTracking.length === 0) {
          continue
        }

        // Apply the fixed analytics logic
        const isSent = (e: any) => !!(e.sent_at || e.delivered_at || e.opened_at || e.clicked_at || e.replied_at)
        const isFailed = (e: any) => e.status === 'failed' && !e.sent_at
        const isBounced = (e: any) => {
          const wasSent = !!(e.sent_at || e.delivered_at)
          const hasBounceIndicators = !!(e.bounced_at || e.bounce_reason || e.status === 'bounced')
          return wasSent && hasBounceIndicators
        }

        const totalEmails = emailTracking.length
        const sentEmails = emailTracking.filter(isSent).length
        const failedEmails = emailTracking.filter(isFailed).length
        const bouncedEmails = emailTracking.filter(isBounced).length

        // Check for data integrity issues
        const incorrectBounces = emailTracking.filter(e =>
          (e.bounced_at || e.bounce_reason) && !e.sent_at
        ).length

        analyticsTests.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          provider: campaign.email_accounts.provider,
          analytics: {
            totalEmails,
            sentEmails,
            failedEmails,
            bouncedEmails,
            incorrectBounces
          },
          healthCheck: {
            noIncorrectBounces: incorrectBounces === 0,
            logicalConsistency: sentEmails + failedEmails <= totalEmails
          }
        })

      } catch (analyticsError) {
        console.error(`❌ Analytics test failed for ${campaign.name}:`, analyticsError)
      }
    }

    // Step 5: Generate recommendations
    console.log('\n💡 Step 5: Generating recommendations...')

    const recommendations = []

    // Check Gmail detection
    const gmailDetectionIssues = gmailProviderTests.filter(test => !test.gmailDetected)
    if (gmailDetectionIssues.length > 0) {
      recommendations.push(`Gmail provider detection failed for ${gmailDetectionIssues.length} campaigns. Check provider field values.`)
    }

    // Check OAuth tokens
    const tokenIssues = gmailProviderTests.filter(test => !test.hasTokens)
    if (tokenIssues.length > 0) {
      recommendations.push(`${tokenIssues.length} Gmail accounts are missing OAuth tokens. Re-authenticate these accounts.`)
    }

    // Check incorrect bounces
    const incorrectBounceIssues = analyticsTests.filter(test => test.analytics.incorrectBounces > 0)
    if (incorrectBounceIssues.length > 0) {
      recommendations.push(`${incorrectBounceIssues.length} campaigns have incorrect bounce data. Run data cleanup script.`)
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All tests passed! The fixed Gmail campaign system appears to be working correctly.')
    }

    console.log('🎉 === FIXED GMAIL CAMPAIGN TESTING COMPLETED ===')

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      testResults: {
        gmailCampaignsFound: gmailCampaigns.length,
        providerDetectionTests: gmailProviderTests,
        processingResults,
        analyticsTests,
        recommendations
      },
      summary: {
        totalCampaignsTested: gmailCampaigns.length,
        successfulProcessing: processingResults.filter(r => r.success).length,
        failedProcessing: processingResults.filter(r => !r.success).length,
        incorrectBouncesFound: analyticsTests.reduce((sum, test) => sum + test.analytics.incorrectBounces, 0),
        healthScore: Math.round(
          (gmailProviderTests.filter(t => t.gmailDetected && t.hasTokens).length / Math.max(gmailProviderTests.length, 1)) * 100
        )
      }
    })

  } catch (error) {
    console.error('💥 Critical error in Gmail campaign testing:', error)

    return Response.json({
      success: false,
      error: 'Gmail campaign testing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST endpoint to manually trigger the fixed processor
 */
export async function POST(request: NextRequest) {
  console.log('🚀 Manual trigger of Fixed Gmail Campaign Processor')

  try {
    await fixedCampaignProcessor.processReadyCampaigns()

    return Response.json({
      success: true,
      message: 'Fixed Gmail Campaign Processor executed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Manual processor trigger failed:', error)

    return Response.json({
      success: false,
      error: 'Processor execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}