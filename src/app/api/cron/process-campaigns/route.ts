import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Universal Cron Job Endpoint for Processing Campaigns
 *
 * This endpoint can be triggered by:
 * 1. Vercel's cron job system (daily at 9:00 AM UTC)
 * 2. Docker Ubuntu cron (every 5 minutes via container)
 * 3. Manual testing (POST/GET requests)
 *
 * Processes TWO types of campaigns:
 * 1. 'scheduled' campaigns → Updates to 'sending' when ready
 * 2. 'sending' campaigns → Processes stuck campaigns directly
 *
 * This fixes the workflow gap where 'sending' campaigns weren't being processed
 * by Docker cron jobs, ensuring scheduled Gmail campaigns work properly.
 *
 * Security: Uses CRON_SECRET environment variable to verify legitimate requests
 * Authentication: Uses Supabase service role key (no user authentication needed)
 */
export async function GET(request: NextRequest) {
  console.log('🕐 Cron job triggered: Processing scheduled & sending campaigns')
  
  try {
    // Security: Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const userAgent = request.headers.get('user-agent')
    
    // Verify authorization (CRON_SECRET) OR Vercel cron user agent
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - invalid CRON_SECRET')
      return new Response('Unauthorized', { status: 401 })
    }
    
    // Additional verification: Check for Vercel cron user agent
    if (!userAgent?.includes('vercel-cron') && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - not from Vercel cron')
      return new Response('Unauthorized', { status: 401 })
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('📡 Connected to Supabase with service role')
    
    const now = new Date()
    console.log(`🕐 Current time (UTC): ${now.toISOString()}`)

    // Process any campaigns scheduled up to now (no lower bound).
    // This prevents missing campaigns if the cron was down for >24h.
    console.log(`📅 Looking for campaigns scheduled up to ${now.toISOString()}`)

    // Find campaigns that need processing:
    // 1. 'scheduled' campaigns ready to send (scheduled_date <= now)
    // 2. 'sending' campaigns that are stuck and need to be processed
    console.log('🔍 Searching for campaigns ready to process (scheduled + sending)...')
    const { data: campaignsToProcess, error: fetchError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        user_id,
        scheduled_date,
        contact_list_ids,
        total_contacts,
        status,
        created_at
      `)
      .in('status', ['scheduled', 'sending'])
      .or(`scheduled_date.lte.${now.toISOString()},status.eq.sending`)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching campaigns to process:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: fetchError.message },
        { status: 500 }
      )
    }

    console.log(`📊 Found ${campaignsToProcess?.length || 0} campaigns ready to process`)

    if (!campaignsToProcess || campaignsToProcess.length === 0) {
      console.log('✅ No campaigns ready to process')
      return NextResponse.json({
        success: true,
        message: 'No campaigns ready to process',
        processed: 0,
        timestamp: now.toISOString()
      })
    }

    // Process each campaign
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const campaign of campaignsToProcess) {
      console.log(`\n🎯 Processing campaign: ${campaign.name} (${campaign.id})`)
      console.log(`📊 Current status: ${campaign.status}`)
      if (campaign.scheduled_date) {
        console.log(`📅 Scheduled for: ${campaign.scheduled_date}`)
      }

      try {
        // Handle status updates based on current status
        if (campaign.status === 'scheduled') {
          // Check if it's time to send scheduled campaigns
          if (campaign.scheduled_date) {
            const scheduledTime = new Date(campaign.scheduled_date)
            if (scheduledTime > now) {
              console.log(`⏰ Campaign ${campaign.id} scheduled for ${scheduledTime.toISOString()}, skipping (not ready yet)`)
              continue
            }
          }

          // Update status from 'scheduled' to 'sending'
          const { error: updateError } = await supabase
            .from('campaigns')
            .update({
              status: 'sending',
              send_immediately: true,
              updated_at: now.toISOString()
            })
            .eq('id', campaign.id)

          if (updateError) {
            console.error(`❌ Failed to update campaign status for ${campaign.name}:`, updateError)
            errorCount++
            results.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              success: false,
              error: updateError.message,
              originalStatus: campaign.status
            })
            continue
          }

          console.log(`✅ Updated ${campaign.name} status from 'scheduled' to 'sending'`)
        } else if (campaign.status === 'sending') {
          console.log(`🔄 Campaign ${campaign.name} already in 'sending' status - will process directly`)
        }

        // Trigger the FIXED campaign processor for this specific campaign
        try {
          // Import the working campaign processor (fixed processor has JOIN issues with SMTP)
          const { campaignProcessor } = await import('@/lib/campaign-processor')

          // Process this specific campaign
          console.log(`🚀 Processing campaign ${campaign.name} with working processor`)

          // Wait for the processor to complete (instead of background processing)
          // This ensures we catch any errors and report them properly
          await campaignProcessor.processReadyCampaigns()
          
          successCount++
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: true,
            message: 'Campaign processing completed successfully',
            originalStatus: campaign.status
          })

          console.log(`✅ Successfully processed ${campaign.name}`)
          
        } catch (processingError) {
          console.error(`❌ Error processing ${campaign.name}:`, processingError)
          
          // Revert status back to scheduled if processing failed
          await supabase
            .from('campaigns')
            .update({ status: 'scheduled' })
            .eq('id', campaign.id)
            
          errorCount++
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: false,
            error: processingError instanceof Error ? processingError.message : 'Campaign processing failed',
            originalStatus: campaign.status
          })
        }
        
      } catch (campaignError) {
        console.error(`❌ Error processing campaign ${campaign.name}:`, campaignError)
        errorCount++
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error',
          originalStatus: campaign.status
        })
      }
    }

    const summary = {
      success: true,
      processed: campaignsToProcess.length,
      successful: successCount,
      errors: errorCount,
      timestamp: now.toISOString(),
      results,
      details: {
        scheduledCampaigns: results.filter(r => r.originalStatus === 'scheduled').length,
        sendingCampaigns: results.filter(r => r.originalStatus === 'sending').length
      }
    }

    console.log(`\n📊 Cron job completed:`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📅 Processed: ${campaignsToProcess.length} campaigns`)
    console.log(`   📊 Breakdown: ${summary.details.scheduledCampaigns} scheduled → sending, ${summary.details.sendingCampaigns} already sending`)

    return NextResponse.json(summary)

  } catch (error) {
    console.error('💥 Critical error in cron job:', error)
    console.error('📋 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for manual testing of the cron job
 * This allows developers to test the cron logic manually
 */
export async function POST(request: NextRequest) {
  console.log('🧪 Manual cron job test triggered')
  
  // For manual testing, we'll accept the request but log it
  console.log('⚠️  Note: This is a manual test of the cron job endpoint')
  
  // Call the same logic as GET
  return GET(request)
}
