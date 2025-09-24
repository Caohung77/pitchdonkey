#!/usr/bin/env node

/**
 * Campaign Bulk Send Debug Script
 * Analyzes why campaigns stop sending after the first batch
 */

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
)

async function debugCampaignSending() {
  console.log('🔍 === CAMPAIGN BULK SEND DEBUGGING ===\n')

  try {
    // Get campaigns with sending status
    console.log('1. Finding campaigns with sending status...')
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        daily_send_limit, total_contacts,
        first_batch_sent_at, current_batch_number,
        next_batch_send_time, emails_sent
      `)
      .in('status', ['sending', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError)
      return
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ No campaigns found with sending/scheduled status')
      return
    }

    console.log(`📊 Found ${campaigns.length} active campaigns:`)
    campaigns.forEach((campaign, i) => {
      console.log(`  ${i+1}. ${campaign.name} (${campaign.id})`)
      console.log(`     Status: ${campaign.status}`)
      console.log(`     Daily Limit: ${campaign.daily_send_limit || 'not set'}`)
      console.log(`     Total Contacts: ${campaign.total_contacts || 'not set'}`)
      console.log(`     Emails Sent: ${campaign.emails_sent || 0}`)
      console.log(`     First Batch: ${campaign.first_batch_sent_at || 'not sent'}`)
      console.log(`     Current Batch #: ${campaign.current_batch_number || 0}`)
      console.log(`     Next Batch Time: ${campaign.next_batch_send_time || 'not scheduled'}`)
      console.log('')
    })

    // Analyze the first campaign in detail
    if (campaigns.length > 0) {
      const campaign = campaigns[0]
      console.log(`\n2. Detailed analysis of campaign: ${campaign.name}`)

      // Check contact lists
      const { data: contactListData } = await supabase
        .from('campaigns')
        .select('contact_list_ids')
        .eq('id', campaign.id)
        .single()

      let totalContactsInLists = 0
      if (contactListData?.contact_list_ids?.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids, name')
          .in('id', contactListData.contact_list_ids)

        console.log(`📋 Contact Lists (${contactLists?.length || 0}):`)
        contactLists?.forEach(list => {
          const count = list.contact_ids?.length || 0
          totalContactsInLists += count
          console.log(`   - ${list.name}: ${count} contacts`)
        })
      }

      console.log(`👥 Total contacts in lists: ${totalContactsInLists}`)

      // Check email tracking records
      const { data: emailTracking } = await supabase
        .from('email_tracking')
        .select('status, sent_at, created_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })

      console.log(`📧 Email tracking records: ${emailTracking?.length || 0}`)

      const statusCounts = {}
      let sentToday = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      emailTracking?.forEach(record => {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1

        if (record.sent_at) {
          const sentDate = new Date(record.sent_at)
          if (sentDate >= today) {
            sentToday++
          }
        }
      })

      console.log('📊 Email status breakdown:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`)
      })
      console.log(`📅 Emails sent today: ${sentToday}`)

      // Check batch timing logic
      if (campaign.next_batch_send_time) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const now = new Date()
        const timeUntilNext = nextBatchTime.getTime() - now.getTime()
        const hoursUntilNext = timeUntilNext / (1000 * 60 * 60)

        console.log(`⏰ Batch timing analysis:`)
        console.log(`   Next batch scheduled: ${nextBatchTime.toISOString()}`)
        console.log(`   Current time: ${now.toISOString()}`)
        console.log(`   Time until next batch: ${hoursUntilNext.toFixed(2)} hours`)
        console.log(`   Can send now: ${timeUntilNext <= 5 * 60 * 1000 ? 'YES' : 'NO'} (5-minute window)`)
      }

      // Analyze potential issues
      console.log(`\n3. 🔧 POTENTIAL ISSUES ANALYSIS:`)

      const issues = []

      // Issue 1: Daily limit vs contacts
      const dailyLimit = campaign.daily_send_limit || 5
      if (totalContactsInLists > dailyLimit) {
        const batchesNeeded = Math.ceil(totalContactsInLists / dailyLimit)
        issues.push(`📈 Need ${batchesNeeded} batches to send to all ${totalContactsInLists} contacts (daily limit: ${dailyLimit})`)
      }

      // Issue 2: Next batch timing
      if (campaign.next_batch_send_time) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const now = new Date()
        if (nextBatchTime > now) {
          const hoursUntil = (nextBatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)
          issues.push(`⏳ Next batch not ready yet (${hoursUntil.toFixed(1)} hours remaining)`)
        }
      } else if (campaign.first_batch_sent_at && !campaign.next_batch_send_time) {
        issues.push(`🚨 CRITICAL: Missing next_batch_send_time despite having sent first batch`)
      }

      // Issue 3: Batch processor not running
      if (emailTracking?.length > 0 && emailTracking?.length < totalContactsInLists) {
        const lastSentTime = emailTracking
          ?.filter(e => e.sent_at)
          ?.map(e => new Date(e.sent_at))
          ?.sort((a, b) => b.getTime() - a.getTime())[0]

        if (lastSentTime) {
          const hoursSinceLastSend = (new Date().getTime() - lastSentTime.getTime()) / (1000 * 60 * 60)
          if (hoursSinceLastSend > 25) { // More than 25 hours since last send
            issues.push(`🚨 CRITICAL: Last email sent ${hoursSinceLastSend.toFixed(1)} hours ago - processor may be stuck`)
          }
        }
      }

      // Issue 4: Status inconsistencies
      const sentCount = emailTracking?.filter(e => e.sent_at)?.length || 0
      if (sentCount >= totalContactsInLists && campaign.status !== 'completed') {
        issues.push(`✅ All emails sent but campaign status is still "${campaign.status}" (should be "completed")`)
      }

      if (issues.length > 0) {
        console.log('🚨 ISSUES FOUND:')
        issues.forEach((issue, i) => {
          console.log(`   ${i+1}. ${issue}`)
        })
      } else {
        console.log('✅ No obvious issues detected')
      }

      // Provide solutions
      console.log(`\n4. 🔧 RECOMMENDED SOLUTIONS:`)

      if (campaign.next_batch_send_time) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const now = new Date()
        const timeUntilNext = nextBatchTime.getTime() - now.getTime()

        if (timeUntilNext <= 5 * 60 * 1000) { // Within 5 minutes
          console.log('✅ 1. Campaign should process on next processor run')
          console.log('   → Make sure the campaign processor is running every 30 seconds')
        } else {
          console.log(`⏳ 1. Wait ${Math.ceil(timeUntilNext / (1000 * 60 * 60))} hours for next scheduled batch`)
          console.log('   → Or manually trigger processing if needed')
        }
      } else if (!campaign.next_batch_send_time && campaign.first_batch_sent_at) {
        console.log('🚨 1. CRITICAL: Fix missing next_batch_send_time')
        console.log('   → Run campaign fixer API or manually set next batch time')
      }

      console.log('\n💡 2. Manual fixes you can try:')
      console.log(`   - Call POST /api/campaigns/processor with action: "process-now"`)
      console.log(`   - Call POST /api/campaigns/fix-stuck-campaigns`)
      console.log(`   - Check campaign processor is running: GET /api/campaigns/processor`)
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error)
  }
}

// Run the debug analysis
debugCampaignSending().then(() => {
  console.log('\n🏁 Debug analysis completed')
  process.exit(0)
}).catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})