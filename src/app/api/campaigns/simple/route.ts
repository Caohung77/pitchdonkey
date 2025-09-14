import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'

export const POST = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()
  try {
    const body = await request.json()
    const {
      name,
      description,
      sender_name,
      email_subject,
      html_content,
      contact_list_ids,
      send_immediately,
      scheduled_date,
      timezone,
      status: providedStatus,
      personalized_emails = {} // Map of contact_id -> { subject, content }
    } = body

    // Determine the correct status based on send_immediately flag
    const status = providedStatus || (send_immediately ? 'sending' : (scheduled_date ? 'scheduled' : 'draft'))

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
    if (!sender_name || sender_name.trim() === '') {
      return NextResponse.json({ error: 'Sender name is required' }, { status: 400 })
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
    if (!send_immediately) {
      if (!scheduled_date) {
        return NextResponse.json({ error: 'Scheduled date is required when not sending immediately' }, { status: 400 })
      }
      const when = new Date(scheduled_date)
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
      }
    }

    // Create the simple campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        description: JSON.stringify({
          description: description || '',
          sender_name: sender_name || '',
          // Store the entire per-contact personalized emails map so we can fall back during sending
          // if the campaign_contacts rows are missing or not created for some contacts.
          personalized_emails: personalized_emails || {}
        }),
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

    // Get all contact IDs from the selected lists
    const { data: contactLists, error: listsError } = await supabase
      .from('contact_lists')
      .select('contact_ids')
      .in('id', contact_list_ids)
      .eq('user_id', user.id)

    if (listsError) {
      console.error('Error fetching contact lists:', listsError)
      return NextResponse.json({ error: 'Failed to fetch contact lists' }, { status: 500 })
    }

    // Flatten all contact IDs
    const allContactIds = contactLists
      .flatMap(list => list.contact_ids || [])
      .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates

    console.log(`📋 Campaign ${campaign.id} will target ${allContactIds.length} contacts`)

    // Helper function to replace placeholders in content when personalized version isn't available
    const replacePersonalizedReasonFallback = (content: string) => {
      if (!content.includes('((personalised_reason))')) {
        return content
      }
      
      // Use generic fallback since we don't have contact data available at this point
      const fallbackReason = `I wanted to connect and discuss potential opportunities.`
      
      return content.replace(/\(\(personalised_reason\)\)/g, fallbackReason)
    }

    // Create campaign_contacts entries with personalized content
    if (allContactIds.length > 0) {
      console.log('🔍 Processing personalized emails for campaign contacts:', {
        totalContacts: allContactIds.length,
        personalizedEmailsProvided: Object.keys(personalized_emails).length,
        personalizedEmailsKeys: Object.keys(personalized_emails),
        allContactIds: allContactIds.slice(0, 3) // Show first 3 for debugging
      })
      
      const campaignContacts = allContactIds.map(contactId => {
        let personalizedBody = personalized_emails[contactId]?.content
        
        console.log(`🔍 Processing contact ${contactId}:`, {
          hasPersonalizedContent: !!personalizedBody,
          personalizedSubject: personalized_emails[contactId]?.subject || 'none',
          contentLength: personalizedBody?.length || 0,
          contentPreview: personalizedBody ? personalizedBody.substring(0, 100) + '...' : 'none'
        })
        
        // If no personalized content available, use fallback replacement for placeholders
        if (!personalizedBody) {
          personalizedBody = replacePersonalizedReasonFallback(html_content)
          console.log(`🔄 Generated fallback personalization for contact ${contactId}`)
        } else {
          console.log(`✅ Using AI-generated personalization for contact ${contactId}`)
        }
        
        return {
          campaign_id: campaign.id,
          contact_id: contactId,
          status: 'pending',
          current_sequence: 1,
          personalized_subject: personalized_emails[contactId]?.subject || email_subject,
          personalized_body: personalizedBody,
          ai_personalization_used: !!personalized_emails[contactId],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      const { error: contactsError } = await supabase
        .from('campaign_contacts')
        .insert(campaignContacts)

      if (contactsError) {
        console.error('Error creating campaign contacts:', contactsError)
        // Don't fail the entire campaign creation for this
      } else {
        console.log(`✅ Created ${campaignContacts.length} campaign contact entries`)
        console.log(`🤖 ${Object.keys(personalized_emails).length} contacts have AI-generated content`)
      }

      // Update campaign with total contacts count
      await supabase
        .from('campaigns')
        .update({ total_contacts: allContactIds.length })
        .eq('id', campaign.id)
    }

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
        // VERCEL FIX: Process campaigns immediately and wait for completion in serverless environment
        await campaignProcessor.processReadyCampaigns()
        
        console.log('✅ Campaign processing completed successfully!')
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
    console.error('Error stack:', error.stack)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      code: 'CREATE_ERROR'
    }, { status: 500 })
  }
})

export const GET = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()
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
    const formattedCampaigns = (campaigns || []).map(campaign => {
      let descriptionText = ''
      try {
        const parsed = typeof campaign.description === 'string'
          ? JSON.parse(campaign.description)
          : campaign.description
        descriptionText = parsed?.description || ''
      } catch {
        descriptionText = campaign.description || ''
      }

      return {
        id: campaign.id,
        name: campaign.name,
        description: descriptionText,
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
      }
    })

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
