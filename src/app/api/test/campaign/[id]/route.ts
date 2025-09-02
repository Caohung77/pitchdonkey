import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { campaignProcessor } from '@/lib/campaign-processor'

/**
 * Test endpoint to process a specific campaign by ID
 * This helps debug specific campaign issues
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    console.log(`🧪 Manual processing test for campaign: ${campaignId}`)
    
    const supabase = createServerSupabaseClient()
    
    // Get the specific campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found',
        details: error.message
      }, { status: 404 })
    }
    
    if (!campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 })
    }
    
    console.log(`📋 Campaign found: ${campaign.name} (Status: ${campaign.status})`)
    
    // Check if campaign has required data
    const issues = []
    
    if (!campaign.contact_list_ids || campaign.contact_list_ids.length === 0) {
      issues.push('No contact lists assigned')
    }
    
    if (!campaign.email_subject) {
      issues.push('No email subject')
    }
    
    if (!campaign.html_content) {
      issues.push('No email content')
    }
    
    // Check email accounts
    const { data: emailAccounts, error: emailError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', campaign.user_id)
      .eq('status', 'active')
    
    if (emailError) {
      issues.push(`Email account error: ${emailError.message}`)
    } else if (!emailAccounts || emailAccounts.length === 0) {
      issues.push('No active email accounts')
    }
    
    // Check contacts
    if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
      const { data: contactLists } = await supabase
        .from('contact_lists')
        .select('contact_ids')
        .in('id', campaign.contact_list_ids)
      
      let totalContacts = 0
      contactLists?.forEach(list => {
        if (list.contact_ids && Array.isArray(list.contact_ids)) {
          totalContacts += list.contact_ids.length
        }
      })
      
      if (totalContacts === 0) {
        issues.push('No contacts in selected lists')
      }
    }
    
    if (issues.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Campaign has issues',
        issues,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          contact_list_ids: campaign.contact_list_ids,
          email_subject: !!campaign.email_subject,
          html_content: !!campaign.html_content
        }
      })
    }
    
    // Force campaign status to 'sending' if not already
    if (campaign.status !== 'sending') {
      await supabase
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', campaignId)
        
      console.log(`✅ Updated campaign status to 'sending'`)
    }
    
    // Process the campaign
    console.log(`🚀 Starting campaign processing...`)
    await campaignProcessor.processReadyCampaigns()
    
    // Get updated campaign status
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    
    console.log(`✅ Campaign processing completed`)
    
    return NextResponse.json({
      success: true,
      message: 'Campaign processed successfully',
      campaign: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        status: updatedCampaign.status,
        emails_sent: updatedCampaign.emails_sent,
        total_contacts: updatedCampaign.total_contacts
      },
      emailAccounts: emailAccounts?.map(acc => ({
        id: acc.id,
        email: acc.email,
        provider: acc.provider,
        status: acc.status
      })),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error in campaign test:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Campaign processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return POST(request, { params })
}