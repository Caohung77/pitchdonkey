import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Vercel Cron Job Endpoint for Processing Scheduled Campaigns
 * 
 * This endpoint is triggered by Vercel's cron job system daily at 9:00 AM UTC
 * to check for scheduled campaigns that are ready to be sent.
 * 
 * For Hobby plans: Runs once daily and processes all campaigns scheduled within the past 24 hours
 * For Pro plans: Can be configured to run more frequently (every 5 minutes)
 * 
 * Security: Uses CRON_SECRET environment variable to verify legitimate requests
 * Authentication: Uses Supabase service role key (no user authentication needed)
 */
export async function GET(request: NextRequest) {
  console.log('🕐 Cron job triggered: Processing scheduled campaigns')
  
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

    // Find scheduled campaigns that are ready to send
    console.log('🔍 Searching for scheduled campaigns ready to send...')
    const { data: scheduledCampaigns, error: fetchError } = await supabase
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
      .eq('status', 'scheduled')
      .not('scheduled_date', 'is', null)
      .lte('scheduled_date', now.toISOString())
      .order('scheduled_date', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching scheduled campaigns:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: fetchError.message },
        { status: 500 }
      )
    }

    console.log(`📊 Found ${scheduledCampaigns?.length || 0} campaigns ready to process`)

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      console.log('✅ No scheduled campaigns ready to send')
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

    for (const campaign of scheduledCampaigns) {
      console.log(`\n🎯 Processing campaign: ${campaign.name} (${campaign.id})`)
      console.log(`📅 Scheduled for: ${campaign.scheduled_date}`)
      
      try {
        // Update campaign status from 'scheduled' to 'sending'
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
            error: updateError.message
          })
          continue
        }

        console.log(`✅ Updated ${campaign.name} status from 'scheduled' to 'sending'`)

        // Trigger the campaign processor for this specific campaign
        try {
          // Import the campaign processor dynamically
          const { campaignProcessor } = await import('@/lib/campaign-processor')
          
          // Process this specific campaign
          console.log(`🚀 Triggering campaign processor for ${campaign.name}`)
          
          // We'll process campaigns in background to avoid timeout
          // The processor will handle the actual email sending
          campaignProcessor.processReadyCampaigns().catch(processingError => {
            console.error(`💥 Background processing error for ${campaign.name}:`, processingError)
          })
          
          successCount++
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: true,
            message: 'Campaign processing triggered'
          })

          console.log(`✅ Successfully triggered processing for ${campaign.name}`)
          
        } catch (processingError) {
          console.error(`❌ Error triggering processor for ${campaign.name}:`, processingError)
          
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
            error: processingError instanceof Error ? processingError.message : 'Processing trigger failed'
          })
        }
        
      } catch (campaignError) {
        console.error(`❌ Error processing campaign ${campaign.name}:`, campaignError)
        errorCount++
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error'
        })
      }
    }

    const summary = {
      success: true,
      processed: scheduledCampaigns.length,
      successful: successCount,
      errors: errorCount,
      timestamp: now.toISOString(),
      results
    }

    console.log(`\n📊 Cron job completed:`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📅 Processed: ${scheduledCampaigns.length} campaigns`)

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
