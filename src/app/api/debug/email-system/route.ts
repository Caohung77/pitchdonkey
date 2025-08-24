import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('🔍 DEBUG: Analyzing email sending system...')

    const results = {
      emailAccounts: null,
      campaigns: null,
      contacts: null,
      emailTracking: null,
      systemStatus: {
        hasActiveEmailAccount: false,
        hasSendingCampaigns: false,
        hasContacts: false,
        campaignProcessorReady: false
      },
      errors: []
    }

    try {
      // 1. Check email accounts
      console.log('📧 Checking email accounts...')
      const { data: emailAccounts, error: emailError } = await supabase
        .from('email_accounts')
        .select('id, email, provider, status, smtp_host, smtp_port, created_at')
        .eq('user_id', user.id)

      if (emailError) {
        results.errors.push(`Email accounts error: ${emailError.message}`)
      } else {
        results.emailAccounts = emailAccounts
        results.systemStatus.hasActiveEmailAccount = emailAccounts?.some(acc => acc.status === 'active') || false
        console.log(`  Found ${emailAccounts?.length || 0} email accounts, ${results.systemStatus.hasActiveEmailAccount ? 'with' : 'without'} active accounts`)
      }

      // 2. Check campaigns
      console.log('📋 Checking campaigns...')
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, status, contact_list_ids, email_subject, html_content, emails_sent, total_contacts, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (campaignError) {
        results.errors.push(`Campaigns error: ${campaignError.message}`)
      } else {
        results.campaigns = campaigns
        results.systemStatus.hasSendingCampaigns = campaigns?.some(c => c.status === 'sending') || false
        console.log(`  Found ${campaigns?.length || 0} campaigns, ${results.systemStatus.hasSendingCampaigns ? 'with' : 'without'} sending campaigns`)
      }

      // 3. Check contacts
      console.log('👥 Checking contacts...')
      const { data: contactLists, error: contactListError } = await supabase
        .from('contact_lists')
        .select('id, name, contact_ids')
        .eq('user_id', user.id)

      if (contactListError) {
        results.errors.push(`Contact lists error: ${contactListError.message}`)
      } else {
        let totalContacts = 0
        contactLists?.forEach(list => {
          if (list.contact_ids && Array.isArray(list.contact_ids)) {
            totalContacts += list.contact_ids.length
          }
        })
        
        results.contacts = {
          lists: contactLists?.length || 0,
          totalContacts
        }
        results.systemStatus.hasContacts = totalContacts > 0
        console.log(`  Found ${contactLists?.length || 0} contact lists with ${totalContacts} total contacts`)
      }

      // 4. Check email tracking
      console.log('📊 Checking email tracking...')
      const { data: emailTracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('campaign_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (trackingError) {
        results.errors.push(`Email tracking error: ${trackingError.message}`)
      } else {
        results.emailTracking = emailTracking
        console.log(`  Found ${emailTracking?.length || 0} email tracking records`)
      }

      // 5. Test campaign processor
      console.log('🚀 Testing campaign processor...')
      try {
        const { campaignProcessor } = await import('@/lib/campaign-processor')
        results.systemStatus.campaignProcessorReady = true
        console.log('  Campaign processor loaded successfully')
      } catch (error) {
        results.errors.push(`Campaign processor error: ${error.message}`)
        results.systemStatus.campaignProcessorReady = false
      }

    } catch (error) {
      results.errors.push(`System check error: ${error.message}`)
    }

    // Summary
    console.log('📈 System Status Summary:')
    console.log(`  Email Accounts: ${results.systemStatus.hasActiveEmailAccount ? '✅' : '❌'}`)
    console.log(`  Sending Campaigns: ${results.systemStatus.hasSendingCampaigns ? '✅' : '❌'}`)  
    console.log(`  Contacts: ${results.systemStatus.hasContacts ? '✅' : '❌'}`)
    console.log(`  Campaign Processor: ${results.systemStatus.campaignProcessorReady ? '✅' : '❌'}`)
    console.log(`  Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})