import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Checking current campaign statuses...')
    
    // Get all campaigns
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        total_contacts,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (campaignError) {
      console.error('❌ Error fetching campaigns:', campaignError)
      return NextResponse.json({ error: campaignError.message }, { status: 500 })
    }
    
    console.log(`📊 Found ${campaigns?.length || 0} campaigns`)
    
    const results = []
    
    for (const campaign of campaigns || []) {
      // Count emails from email_tracking table
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('sent_at, delivered_at, opened_at, status')
        .eq('campaign_id', campaign.id)
      
      const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
      const totalContacts = campaign.total_contacts || 0
      
      const shouldBeComplete = sentCount >= totalContacts && totalContacts > 0
      
      results.push({
        id: campaign.id,
        name: campaign.name,
        current_status: campaign.status,
        sentCount,
        totalContacts,
        shouldBeComplete,
        completionPercentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0,
        emailRecords: emailStats?.length || 0,
        needsStatusUpdate: shouldBeComplete && campaign.status !== 'completed'
      })
      
      console.log(`📋 Campaign: ${campaign.name} - Status: ${campaign.status} - Progress: ${sentCount}/${totalContacts}`)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Campaign status check completed',
      results: results,
      summary: {
        total: results.length,
        needingUpdate: results.filter(r => r.needsStatusUpdate).length,
        alreadyCompleted: results.filter(r => r.current_status === 'completed').length
      }
    })
    
  } catch (error) {
    console.error('💥 Status check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Status check failed',
      details: error.message
    }, { status: 500 })
  }
}