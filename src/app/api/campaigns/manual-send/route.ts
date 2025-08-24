import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('🧪 === MANUAL EMAIL SENDING TEST ===')
    console.log(`👤 User: ${user.email} (${user.id})`)

    // Get the most recent campaign with 'sending' status
    console.log('🔍 Looking for campaigns with "sending" status...')
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'sending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (campaignError) {
      console.error('❌ Error fetching campaigns:', campaignError)
      return NextResponse.json({ error: `Failed to fetch campaigns: ${campaignError.message}` }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ No campaigns with "sending" status found')
      
      // Get all campaigns to see what we have
      const { data: allCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      console.log('📋 Recent campaigns:')
      allCampaigns?.forEach(c => {
        console.log(`  - ${c.name} (${c.id}) - Status: ${c.status} - Created: ${c.created_at}`)
      })

      return NextResponse.json({ 
        error: 'No campaigns with "sending" status found',
        recentCampaigns: allCampaigns
      }, { status: 404 })
    }

    const campaign = campaigns[0]
    console.log(`🎯 Found campaign to process: "${campaign.name}" (${campaign.id})`)
    console.log(`📧 Subject: "${campaign.email_subject}"`)
    console.log(`👥 Contact lists: ${JSON.stringify(campaign.contact_list_ids)}`)

    // Manually trigger the campaign processor
    console.log('🚀 Manually triggering campaign processor...')
    
    try {
      const { campaignProcessor } = await import('@/lib/campaign-processor')
      console.log('📦 Campaign processor loaded successfully')
      
      await campaignProcessor.processReadyCampaigns()
      console.log('✅ Campaign processing completed')
      
      return NextResponse.json({
        success: true,
        message: 'Campaign processing triggered manually',
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          email_subject: campaign.email_subject,
          contact_list_ids: campaign.contact_list_ids
        }
      })

    } catch (processingError) {
      console.error('💥 Campaign processing error:', processingError)
      console.error('📋 Error stack:', processingError.stack)
      
      return NextResponse.json({
        error: 'Campaign processing failed',
        details: processingError.message,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Manual send endpoint error:', error)
    return NextResponse.json({
      error: 'Manual send failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})