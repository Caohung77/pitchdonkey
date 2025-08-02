import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaigns with basic stats
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        description,
        status,
        email_sequence,
        created_at,
        launched_at,
        completed_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // For each campaign, get contact count and email stats
    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        // Get contact count (mock for now)
        const contactCount = Math.floor(Math.random() * 500) + 50

        // Get email stats (mock for now)
        const emailsSent = Math.floor(Math.random() * contactCount * 3)
        const openRate = Math.floor(Math.random() * 40) + 15
        const replyRate = Math.floor(Math.random() * 15) + 2

        // Calculate next send time for active campaigns
        let nextSendAt = null
        if (campaign.status === 'active') {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0) // 9 AM tomorrow
          nextSendAt = tomorrow.toISOString()
        }

        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description || '',
          status: campaign.status,
          contactCount,
          emailsSent,
          openRate,
          replyRate,
          createdAt: campaign.created_at,
          launchedAt: campaign.launched_at,
          completedAt: campaign.completed_at,
          nextSendAt
        }
      })
    )

    return NextResponse.json(campaignsWithStats)

  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      contactSegments,
      emailSequence,
      aiSettings,
      scheduleSettings,
      status = 'draft'
    } = body

    // Validate required fields
    if (!name || !emailSequence || emailSequence.length === 0) {
      return NextResponse.json(
        { error: 'Name and email sequence are required' },
        { status: 400 }
      )
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        description,
        status,
        contact_list_ids: contactSegments || [],
        email_sequence: emailSequence,
        ai_settings: aiSettings || {},
        schedule_settings: scheduleSettings || {},
        launched_at: status === 'active' ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // If campaign is being launched, you would typically:
    // 1. Validate email accounts are connected
    // 2. Check usage limits
    // 3. Queue initial emails
    // 4. Start the campaign execution process

    return NextResponse.json(campaign, { status: 201 })

  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}