/**
 * Script to manually process stuck unclassified emails
 * Run with: npx tsx scripts/process-stuck-emails.ts
 */

import { createClient } from '@supabase/supabase-js'
import { ReplyProcessor } from '../lib/reply-processor'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  console.log('🚀 Starting stuck email processing...')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Find all unclassified emails
  const { data: emails, error } = await supabase
    .from('incoming_emails')
    .select('id, user_id, from_address, subject, date_received, classification_status, processing_status')
    .eq('classification_status', 'unclassified')
    .eq('processing_status', 'pending')
    .order('date_received', { ascending: true })

  if (error) {
    console.error('❌ Error fetching emails:', error)
    return
  }

  if (!emails || emails.length === 0) {
    console.log('✅ No stuck emails found!')
    return
  }

  console.log(`📧 Found ${emails.length} unclassified emails`)

  // Group by user
  const byUser = emails.reduce((acc, email) => {
    if (!acc[email.user_id]) {
      acc[email.user_id] = []
    }
    acc[email.user_id].push(email)
    return acc
  }, {} as Record<string, typeof emails>)

  // Process each user's emails
  for (const [userId, userEmails] of Object.entries(byUser)) {
    console.log(`\n👤 Processing ${userEmails.length} emails for user ${userId}`)

    userEmails.forEach((email, i) => {
      const age = Math.floor((Date.now() - new Date(email.date_received).getTime()) / (60 * 1000))
      console.log(`  ${i + 1}. ${email.from_address} - "${email.subject}" (${age} min old)`)
    })

    try {
      const replyProcessor = new ReplyProcessor()
      const result = await replyProcessor.processUnclassifiedEmails(userId, userEmails.length)

      console.log(`\n✅ Results for user ${userId}:`)
      console.log(`   Processed: ${result.processed}`)
      console.log(`   Successful: ${result.successful}`)
      console.log(`   Failed: ${result.failed}`)
      console.log(`   Auto-drafts created: ${result.autonomousDraftsCreated || 0}`)

      if (result.errors.length > 0) {
        console.log(`\n⚠️  Errors:`)
        result.errors.forEach(err => console.log(`   - ${err}`))
      }

    } catch (error) {
      console.error(`❌ Error processing user ${userId}:`, error)
    }
  }

  console.log('\n✨ Done!')
}

main().catch(console.error)
