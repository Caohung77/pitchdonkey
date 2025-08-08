import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      console.error('Error fetching campaign:', error)
      return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
    }

    return NextResponse.json(campaign)

  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('PATCH request body:', body)
    
    const updates: any = {}

    // Handle status changes
    if (body.status) {
      // Map frontend status to database status
      let dbStatus = body.status
      if (body.status === 'active') {
        dbStatus = 'running' // Database uses 'running' instead of 'active'
      }
      
      updates.status = dbStatus
      
      // Set timestamps based on status changes
      if (dbStatus === 'running' && !updates.start_date) {
        updates.start_date = new Date().toISOString()
      } else if (dbStatus === 'completed' && !updates.end_date) {
        updates.end_date = new Date().toISOString()
      } else if (dbStatus === 'stopped') {
        updates.stopped_at = new Date().toISOString()
      }
    }

    // Handle other updates
    if (body.name) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.emailSequence) updates.email_sequence = body.emailSequence
    if (body.aiSettings) updates.ai_settings = body.aiSettings
    if (body.scheduleSettings) updates.schedule_settings = body.scheduleSettings

    console.log('Campaign updates:', updates)

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating campaign:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // Handle campaign state changes
    try {
      if (body.status === 'active' || body.status === 'running') {
        // Resume campaign execution
        const { CampaignExecutionEngine } = await import('@/lib/campaign-execution')
        await CampaignExecutionEngine.resumeCampaign(params.id, supabase)
        console.log(`Resumed campaign ${params.id}`)
      } else if (body.status === 'paused') {
        // Pause campaign execution
        const { CampaignExecutionEngine } = await import('@/lib/campaign-execution')
        await CampaignExecutionEngine.pauseCampaign(params.id, supabase)
        console.log(`Paused campaign ${params.id}`)
      } else if (body.status === 'stopped') {
        // Stop campaign execution permanently
        const { CampaignExecutionEngine } = await import('@/lib/campaign-execution')
        await CampaignExecutionEngine.stopCampaign(params.id, supabase)
        console.log(`Stopped campaign ${params.id}`)
      }
    } catch (executionError) {
      console.error('Campaign execution error:', executionError)
      // Don't fail the entire request if execution management fails
      // The status update was successful, just log the execution error
    }

    return NextResponse.json(campaign)

  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if campaign exists and belongs to user
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      console.error('Error fetching campaign:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
    }

    // Don't allow deletion of active campaigns
    if (campaign.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete active campaign. Please pause it first.' },
        { status: 400 }
      )
    }

    // Delete campaign
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Campaign deleted successfully' })

  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}