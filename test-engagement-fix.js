// Test script to verify engagement recalculation works
// Run this with: node test-engagement-fix.js

const { createServerSupabaseClient } = require('./lib/supabase-server')
const { recalculateContactEngagement } = require('./lib/contact-engagement')

async function testEngagementRecalculation() {
  try {
    console.log('🔄 Testing engagement recalculation...')

    const supabase = await createServerSupabaseClient()

    // Get a contact that has been sent emails but shows as 'not_contacted'
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        id,
        email,
        first_name,
        last_name,
        engagement_status,
        engagement_score,
        engagement_sent_count,
        engagement_open_count,
        engagement_click_count
      `)
      .eq('engagement_status', 'not_contacted')
      .limit(5)

    if (error) {
      console.error('❌ Error fetching contacts:', error)
      return
    }

    if (!contacts || contacts.length === 0) {
      console.log('ℹ️  No contacts with "not_contacted" status found to test')
      return
    }

    console.log(`📊 Found ${contacts.length} contacts with 'not_contacted' status`)

    for (const contact of contacts) {
      console.log(`\n🔍 Testing contact: ${contact.email}`)
      console.log(`   Before: status=${contact.engagement_status}, score=${contact.engagement_score}`)

      // Check if this contact has any email tracking events
      const { data: tracking } = await supabase
        .from('email_tracking')
        .select('sent_at, opened_at, clicked_at, replied_at')
        .eq('contact_id', contact.id)

      if (!tracking || tracking.length === 0) {
        console.log('   ⚠️  No email tracking found for this contact')
        continue
      }

      const sent = tracking.filter(t => t.sent_at).length
      const opened = tracking.filter(t => t.opened_at).length
      const clicked = tracking.filter(t => t.clicked_at).length
      const replied = tracking.filter(t => t.replied_at).length

      console.log(`   📧 Email events: sent=${sent}, opened=${opened}, clicked=${clicked}, replied=${replied}`)

      if (sent > 0 || opened > 0 || clicked > 0 || replied > 0) {
        // This contact should not be 'not_contacted' - let's recalculate
        console.log('   🔄 Recalculating engagement...')
        const result = await recalculateContactEngagement(supabase, contact.id)

        if (result) {
          console.log(`   ✅ After: status=${result.status}, score=${result.score}`)
          if (result.status !== 'not_contacted') {
            console.log('   🎉 Status successfully updated!')
          }
        } else {
          console.log('   ❌ Recalculation failed')
        }
      } else {
        console.log('   ✅ Contact correctly shows as not_contacted')
      }
    }

    console.log('\n🏁 Test completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testEngagementRecalculation()