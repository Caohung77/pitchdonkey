#!/usr/bin/env node

// Manual recalculation script for existing contacts
// This will process contacts in smaller batches to avoid timeouts

const { createClient } = require('@supabase/supabase-js')
const { recalculateContactEngagement } = require('./lib/contact-engagement')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function recalculateEngagementForOldCampaigns() {
  console.log('🔄 Starting recalculation for existing contacts...')

  try {
    // Find contacts that have email tracking data but show as 'not_contacted'
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        id,
        email,
        first_name,
        last_name,
        engagement_status,
        engagement_score
      `)
      .or('engagement_status.eq.not_contacted,engagement_status.is.null')
      .limit(50) // Process in batches

    if (error) {
      console.error('❌ Error fetching contacts:', error.message)
      return
    }

    console.log(`📊 Found ${contacts.length} contacts to check`)

    let processed = 0
    let updated = 0
    let skipped = 0

    for (const contact of contacts) {
      try {
        // Check if this contact has email tracking data
        const { data: tracking, error: trackingError } = await supabase
          .from('email_tracking')
          .select('sent_at, opened_at, clicked_at, replied_at')
          .eq('contact_id', contact.id)

        if (trackingError) {
          console.error(`⚠️  Error checking tracking for ${contact.email}:`, trackingError.message)
          continue
        }

        if (!tracking || tracking.length === 0) {
          skipped++
          continue
        }

        const sent = tracking.filter(t => t.sent_at).length
        const opened = tracking.filter(t => t.opened_at).length
        const clicked = tracking.filter(t => t.clicked_at).length
        const replied = tracking.filter(t => t.replied_at).length

        console.log(`📧 ${contact.email}: sent=${sent}, opened=${opened}, clicked=${clicked}, replied=${replied}`)

        if (sent > 0 || opened > 0 || clicked > 0 || replied > 0) {
          // This contact has tracking data - recalculate engagement
          console.log(`   🔄 Recalculating...`)

          const result = await recalculateContactEngagement(supabase, contact.id)

          if (result) {
            console.log(`   ✅ Updated: ${contact.engagement_status} → ${result.status} (score: ${result.score})`)
            if (result.status !== contact.engagement_status) {
              updated++
            }
          } else {
            console.log(`   ❌ Failed to recalculate`)
          }
        } else {
          skipped++
        }

        processed++

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ Error processing ${contact.email}:`, error.message)
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Processed: ${processed}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Skipped: ${skipped}`)

    if (contacts.length === 50) {
      console.log(`\n🔄 This was a batch of 50. Run the script again to process more contacts.`)
    } else {
      console.log(`\n🎉 All contacts processed!`)
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message)
  }
}

// Check for contacts that might need updating
async function checkContactsNeedingUpdate() {
  console.log('🔍 Checking how many contacts might need recalculation...')

  try {
    // Count contacts with 'not_contacted' status that have email tracking
    const { data: result, error } = await supabase
      .from('contacts')
      .select(`
        id,
        engagement_status,
        email_tracking!inner(contact_id)
      `)
      .or('engagement_status.eq.not_contacted,engagement_status.is.null')

    if (error) {
      console.error('❌ Error checking contacts:', error.message)
      return
    }

    console.log(`📊 Found ${result.length} contacts that are 'not_contacted' but have email tracking data`)

    if (result.length > 0) {
      console.log('🎯 These contacts likely need their engagement status recalculated.')
      return true
    } else {
      console.log('✅ All contacts appear to have correct engagement status.')
      return false
    }
  } catch (error) {
    console.error('❌ Check failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting engagement recalculation for old campaigns\n')

  const needsUpdate = await checkContactsNeedingUpdate()

  if (needsUpdate) {
    console.log('\n▶️  Starting recalculation...\n')
    await recalculateEngagementForOldCampaigns()
  }

  console.log('\n✅ Done!')
}

main().catch(console.error)