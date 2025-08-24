import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const body = await request.json()
    const {
      name,
      description,
      email_subject,
      html_content,
      contact_list_ids,
      send_immediately,
      scheduled_date,
      timezone,
      status = 'draft'
    } = body

    console.log('Creating simple campaign with data:', { 
      name, 
      status, 
      send_immediately, 
      contact_list_ids,
      email_subject,
      html_content: html_content ? html_content.substring(0, 100) + '...' : null,
      scheduled_date,
      timezone 
    })

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }
    if (!email_subject) {
      return NextResponse.json({ error: 'Email subject is required' }, { status: 400 })
    }
    if (!html_content) {
      return NextResponse.json({ error: 'Email content is required' }, { status: 400 })
    }
    if (!contact_list_ids || contact_list_ids.length === 0) {
      return NextResponse.json({ error: 'At least one contact list is required' }, { status: 400 })
    }

    // If scheduling for later, validate scheduled date
    if (!send_immediately && !scheduled_date) {
      return NextResponse.json({ error: 'Scheduled date is required when not sending immediately' }, { status: 400 })
    }

    // Create the simple campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        description: description || '',
        status,
        email_subject,
        html_content,
        contact_list_ids,
        send_immediately: send_immediately || false,
        scheduled_date: scheduled_date || null,
        timezone: timezone || 'UTC',
        // Set default values for required fields
        daily_send_limit: 50,
        track_opens: true,
        track_clicks: true,
        track_replies: true,
        ab_test_enabled: false,
        ab_test_config: {},
        total_contacts: 0,
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_clicked: 0,
        emails_replied: 0,
        emails_bounced: 0,
        emails_complained: 0
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating simple campaign:', {
        error: campaignError,
        message: campaignError.message,
        details: campaignError.details,
        hint: campaignError.hint,
        code: campaignError.code
      })
      return NextResponse.json({ 
        error: 'Failed to create campaign', 
        details: campaignError.message,
        code: campaignError.code
      }, { status: 500 })
    }

    console.log('Simple campaign created successfully:', campaign.id)

    // If the campaign is set to send immediately, trigger processing
    if (status === 'sending') {
      console.log('🚀 Campaign created with SENDING status - triggering immediate processing...')
      console.log(`📋 Campaign details: ${campaign.id} - "${campaign.name}"`)
      console.log(`📧 Email subject: "${campaign.email_subject}"`)
      console.log(`👥 Contact lists: ${JSON.stringify(campaign.contact_list_ids)}`)
      
      try {
        // Import and trigger campaign processor
        console.log('📦 Loading campaign processor...')
        const { campaignProcessor } = await import('@/lib/campaign-processor')
        
        console.log('⚡ Starting campaign processing...')
        // Process campaigns in background (don't wait for completion)
        campaignProcessor.processReadyCampaigns().catch(error => {
          console.error('💥 Background campaign processing error:', error)
        })
        
        console.log('✅ Campaign processing triggered successfully!')
        console.log('🔍 Check server logs above for email sending activity...')
      } catch (error) {
        console.error('⚠️ Failed to trigger campaign processing:', error)
        console.error('📋 Error details:', error.stack)
        // Don't fail the campaign creation if processing trigger fails
      }
    } else {
      console.log(`📝 Campaign created with status: ${status} (not sending immediately)`)
    }

    return NextResponse.json({
      success: true,
      data: campaign
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating simple campaign:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'CREATE_ERROR'
    }, { status: 500 })
  }
})

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get simple campaigns (campaigns with html_content)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        description,
        status,
        email_subject,
        send_immediately,
        scheduled_date,
        contact_list_ids,
        total_contacts,
        emails_sent,
        emails_delivered,
        emails_opened,
        emails_replied,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .not('html_content', 'is', null)
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Error fetching simple campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Format campaigns for display
    const formattedCampaigns = (campaigns || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      email_subject: campaign.email_subject,
      send_immediately: campaign.send_immediately,
      scheduled_date: campaign.scheduled_date,
      contactCount: campaign.total_contacts || 0,
      emailsSent: campaign.emails_sent || 0,
      openRate: campaign.emails_delivered > 0 
        ? Math.round((campaign.emails_opened / campaign.emails_delivered) * 100) 
        : 0,
      replyRate: campaign.emails_sent > 0 
        ? Math.round((campaign.emails_replied / campaign.emails_sent) * 100) 
        : 0,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      type: 'simple'
    }))

    return NextResponse.json({
      success: true,
      data: formattedCampaigns
    })

  } catch (error) {
    console.error('Error fetching simple campaigns:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'FETCH_ERROR'
    }, { status: 500 })
  }
})