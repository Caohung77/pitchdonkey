import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { campaignId } = await request.json()

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }

    console.log(`🧪 Testing email sending for campaign: ${campaignId}`)

    // Get the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log(`📋 Campaign found: ${campaign.name} (${campaign.status})`)

    // Get contacts from contact lists
    let contacts = []
    if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
      console.log(`📝 Getting contacts from ${campaign.contact_list_ids.length} contact lists`)
      
      const { data: contactLists, error: listError } = await supabase
        .from('contact_lists')
        .select('contact_ids')
        .in('id', campaign.contact_list_ids)
      
      if (listError) {
        return NextResponse.json({ error: `Failed to get contact lists: ${listError.message}` }, { status: 500 })
      }
      
      const contactIds = []
      contactLists?.forEach(list => {
        if (list.contact_ids && Array.isArray(list.contact_ids)) {
          contactIds.push(...list.contact_ids)
        }
      })
      
      const uniqueContactIds = [...new Set(contactIds)]
      console.log(`👥 Found ${uniqueContactIds.length} unique contact IDs`)
      
      if (uniqueContactIds.length > 0) {
        const { data: contactData, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .in('id', uniqueContactIds)
        
        if (contactsError) {
          return NextResponse.json({ error: `Failed to get contacts: ${contactsError.message}` }, { status: 500 })
        }
        
        contacts = contactData || []
      }
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for this campaign' }, { status: 400 })
    }

    console.log(`📧 Ready to process ${contacts.length} contacts:`)
    contacts.forEach((contact, i) => {
      console.log(`  ${i+1}. ${contact.email} (${contact.first_name} ${contact.last_name})`)
    })

    // Get user's email account
    const { data: emailAccounts, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)

    if (accountError || !emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No active email account found. Please configure an SMTP email account first.' 
      }, { status: 400 })
    }

    const emailAccount = emailAccounts[0]
    console.log(`📬 Using email account: ${emailAccount.email} (${emailAccount.provider})`)

    // Import and trigger the campaign processor
    const { campaignProcessor } = await import('@/lib/campaign-processor')
    
    console.log('🚀 Starting email sending process...')
    
    // Process this specific campaign
    await campaignProcessor.processReadyCampaigns()

    return NextResponse.json({
      success: true,
      message: `Email sending initiated for campaign: ${campaign.name}`,
      details: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        contactCount: contacts.length,
        emailAccount: emailAccount.email,
        provider: emailAccount.provider
      }
    })

  } catch (error) {
    console.error('Test send error:', error)
    return NextResponse.json({
      error: 'Failed to test send emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})