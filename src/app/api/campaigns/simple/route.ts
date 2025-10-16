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
      from_email_account_id,
      daily_send_limit,
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

    // Validate chosen email account
    if (!from_email_account_id) {
      return NextResponse.json({ error: 'Email account is required' }, { status: 400 })
    }

    // ============================================================================
    // ENHANCED VALIDATION: Check for time period overlap with existing campaigns
    // ============================================================================
    console.log(`🔍 Checking for campaign time period conflicts for email account: ${from_email_account_id}`)

    // Get all contact IDs FIRST to calculate new campaign duration
    const { data: contactListsPreview, error: listsPreviewError } = await supabase
      .from('contact_lists')
      .select('contact_ids')
      .in('id', contact_list_ids)
      .eq('user_id', user.id)

    if (listsPreviewError) {
      console.error('❌ Error fetching contact lists for validation:', listsPreviewError)
      return NextResponse.json({ error: 'Failed to validate campaign' }, { status: 500 })
    }

    // Calculate new campaign's time period
    const allContactIdsPreview = contactListsPreview
      .flatMap(list => list.contact_ids || [])
      .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates

    const allowedDaily = new Set([5,10,15,20,30,50])
    const finalDailyLimit = allowedDaily.has(Number(daily_send_limit)) ? Number(daily_send_limit) : 50
    const totalContactsPreview = allContactIdsPreview.length
    const totalBatchesPreview = Math.ceil(totalContactsPreview / finalDailyLimit)
    const batchIntervalMinutes = 20

    const newCampaignStart = send_immediately ? new Date() : new Date(scheduled_date)
    const newCampaignEnd = new Date(newCampaignStart.getTime() + ((totalBatchesPreview - 1) * batchIntervalMinutes * 60 * 1000))

    console.log('📅 New campaign time period:', {
      start: newCampaignStart.toISOString(),
      end: newCampaignEnd.toISOString(),
      duration_minutes: (totalBatchesPreview - 1) * batchIntervalMinutes,
      total_batches: totalBatchesPreview
    })

    // Fetch existing campaigns with their batch schedules
    const { data: existingCampaigns, error: existingErr } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, batch_schedule, created_at')
      .eq('user_id', user.id)
      .eq('from_email_account_id', from_email_account_id)
      .in('status', ['sending', 'scheduled'])
      .order('created_at', { ascending: false })

    if (existingErr) {
      console.error('❌ Error checking existing campaigns:', existingErr)
      return NextResponse.json({ error: 'Failed to check email account availability' }, { status: 500 })
    }

    console.log(`🔍 Found ${existingCampaigns?.length || 0} existing active/scheduled campaigns`)

    // Check for time period overlap
    if (existingCampaigns && existingCampaigns.length > 0) {
      const conflicts = []

      for (const existing of existingCampaigns) {
        // Calculate existing campaign's time period from batch_schedule
        let existingStart, existingEnd

        if (existing.batch_schedule?.batches && existing.batch_schedule.batches.length > 0) {
          // Use batch schedule if available
          const batches = existing.batch_schedule.batches
          existingStart = new Date(batches[0].scheduled_time)
          existingEnd = new Date(batches[batches.length - 1].scheduled_time)
        } else if (existing.scheduled_date) {
          // Fallback: estimate based on scheduled_date (less accurate)
          existingStart = new Date(existing.scheduled_date)
          // Assume similar duration if batch_schedule not available
          existingEnd = new Date(existingStart.getTime() + (2 * 60 * 60 * 1000)) // 2 hours default
        } else {
          // Skip if we can't determine time period
          console.warn(`⚠️ Cannot determine time period for campaign ${existing.id}`)
          continue
        }

        console.log(`  Campaign "${existing.name}":`, {
          start: existingStart.toISOString(),
          end: existingEnd.toISOString()
        })

        // Check for overlap: (StartA <= EndB) AND (EndA >= StartB)
        const hasOverlap = (newCampaignStart <= existingEnd) && (newCampaignEnd >= existingStart)

        if (hasOverlap) {
          conflicts.push({
            id: existing.id,
            name: existing.name,
            status: existing.status,
            start: existingStart.toISOString(),
            end: existingEnd.toISOString(),
            created_at: existing.created_at
          })
          console.log(`    ❌ OVERLAP DETECTED with "${existing.name}"`)
        } else {
          console.log(`    ✅ No overlap with "${existing.name}"`)
        }
      }

      if (conflicts.length > 0) {
        console.log(`❌ Found ${conflicts.length} conflicting campaign(s)`)

        // Structure the error data to include everything needed by the UI
        const errorData = {
          type: 'CAMPAIGN_OVERLAP',
          message: `This email account already has campaign(s) scheduled during this time period. Please choose a different time or email account.`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            scheduledStart: c.start,
            scheduledEnd: c.end,
            created_at: c.created_at
          })),
          newCampaignPeriod: {
            start: newCampaignStart.toISOString(),
            end: newCampaignEnd.toISOString()
          }
        }

        // Return error with full details embedded in the error field as JSON
        // This allows the UI to parse and display the conflict information
        return NextResponse.json({
          error: JSON.stringify(errorData),
          message: errorData.message
        }, { status: 409 })
      }
    }

    console.log('✅ No time period conflicts found, proceeding with campaign creation')

    // Note: finalDailyLimit already calculated above in overlap validation (line 94)
    // CRITICAL FIX: Create send_settings object with proper batch_size configuration
    // This is what the campaign processor reads to determine batch size
    const sendSettings = {
      rate_limiting: {
        daily_limit: finalDailyLimit,
        hourly_limit: 10,
        domain_limit: 10,
        account_rotation: true,
        warmup_mode: false,
        batch_size: finalDailyLimit, // This is the actual batch size enforced per cycle
        batch_delay_minutes: 5
      },
      send_immediately: send_immediately || false,
      avoid_weekends: true,
      avoid_holidays: true,
      holiday_list: [],
      time_windows: []
    }

    console.log('🔧 Creating campaign with send_settings:', JSON.stringify(sendSettings, null, 2))

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
        // New: sending controls
        from_email_account_id,
        daily_send_limit: finalDailyLimit,
        send_settings: sendSettings, // CRITICAL FIX: Store send_settings with batch_size
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

    // Calculate batch schedule with 20-minute intervals
    const batchSize = finalDailyLimit
    const totalContacts = allContactIds.length
    const totalBatches = Math.ceil(totalContacts / batchSize)
    const startTime = new Date(scheduled_date || new Date())
    const BATCH_INTERVAL_MINUTES = 20

    console.log(`📅 Calculating batch schedule:`, {
      totalContacts,
      batchSize,
      totalBatches,
      startTime: startTime.toISOString(),
      intervalMinutes: BATCH_INTERVAL_MINUTES
    })

    // Create batch schedule with contact assignments
    const batches = []
    for (let i = 0; i < totalBatches; i++) {
      const batchStartIndex = i * batchSize
      const batchEndIndex = Math.min((i + 1) * batchSize, totalContacts)
      const batchContactIds = allContactIds.slice(batchStartIndex, batchEndIndex)
      const batchTime = new Date(startTime.getTime() + (i * BATCH_INTERVAL_MINUTES * 60 * 1000))

      batches.push({
        batch_number: i + 1,
        scheduled_time: batchTime.toISOString(),
        contact_ids: batchContactIds,
        contact_count: batchContactIds.length,
        status: 'pending'
      })

      console.log(`  Batch ${i + 1}: ${batchTime.toISOString()} → ${batchContactIds.length} contacts`)
    }

    const batchSchedule = {
      batches,
      batch_size: batchSize,
      batch_interval_minutes: BATCH_INTERVAL_MINUTES,
      total_batches: totalBatches,
      total_contacts: totalContacts,
      estimated_completion: batches[batches.length - 1]?.scheduled_time
    }

    console.log(`✅ Batch schedule created: ${totalBatches} batches over ${(totalBatches - 1) * BATCH_INTERVAL_MINUTES} minutes`)
    console.log(`📊 Estimated completion: ${batchSchedule.estimated_completion}`)

    // Update campaign with batch schedule and set next_batch_send_time to first batch
    await supabase
      .from('campaigns')
      .update({
        batch_schedule: batchSchedule,
        next_batch_send_time: batches[0]?.scheduled_time,
        total_contacts: totalContacts
      })
      .eq('id', campaign.id)

    console.log(`💾 Saved batch schedule to campaign ${campaign.id}`)

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
    }

    // Log campaign creation but don't process here - let separate API handle processing
    if (status === 'sending') {
      console.log('🚀 Campaign created with SENDING status')
      console.log(`📋 Campaign details: ${campaign.id} - "${campaign.name}"`)
      console.log(`📧 Email subject: "${campaign.email_subject}"`)
      console.log(`👥 Contact lists: ${JSON.stringify(campaign.contact_list_ids)}`)
      console.log('⏳ Campaign processing will be triggered by separate API call')
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
