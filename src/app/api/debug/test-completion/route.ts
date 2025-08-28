import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🧪 Testing campaign completion logic...')
    
    // Find any campaigns that might be stuck in sending state
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        total_contacts,
        created_at
      `)
      .in('status', ['sending', 'running'])
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (campaignError) {
      console.error('❌ Error fetching campaigns:', campaignError)
      return NextResponse.json({ error: campaignError.message }, { status: 500 })
    }
    
    console.log(`📊 Found ${campaigns?.length || 0} active campaigns`)
    
    const testResults = []
    
    for (const campaign of campaigns || []) {
      // Count emails from email_tracking table
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('sent_at, delivered_at, opened_at')
        .eq('campaign_id', campaign.id)
      
      const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
      const totalContacts = campaign.total_contacts || 0
      
      const shouldBeComplete = sentCount >= totalContacts && totalContacts > 0
      
      testResults.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sentCount,
        totalContacts,
        shouldBeComplete,
        completionPercentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0,
        emailTrackingRecords: emailStats?.length || 0
      })
      
      // If campaign should be complete but isn't, mark it as completed
      if (shouldBeComplete && campaign.status !== 'completed') {
        console.log(`🔧 Marking campaign ${campaign.name} as completed (${sentCount}/${totalContacts})`)
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            status: 'completed'
          })
          .eq('id', campaign.id)
        
        if (updateError) {
          console.error(`❌ Failed to update campaign ${campaign.id}:`, updateError)
          testResults[testResults.length - 1].updateError = updateError.message
        } else {
          console.log(`✅ Successfully updated campaign ${campaign.id} to completed`)
          testResults[testResults.length - 1].statusUpdated = true
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Campaign completion test completed',
      results: testResults,
      summary: {
        totalTested: testResults.length,
        shouldBeComplete: testResults.filter(r => r.shouldBeComplete).length,
        fixedCampaigns: testResults.filter(r => r.statusUpdated).length
      }
    })
    
  } catch (error) {
    console.error('💥 Test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
  }
}