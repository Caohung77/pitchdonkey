import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBounceProcessor } from '@/lib/bounce-processor'

/**
 * POST /api/bounces/process
 *
 * Process bounce emails manually or via webhook
 * Can process a specific email by ID or process all unprocessed bounces
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { emailId, processAll = false } = body

    const bounceProcessor = createBounceProcessor(supabase)

    // Process a specific email
    if (emailId) {
      console.log(`📧 Processing bounce for email ${emailId}`)

      const result = await bounceProcessor.processIncomingEmail(emailId)

      return NextResponse.json({
        success: result.success,
        bounceDetected: result.bounceDetected,
        contactId: result.contactId,
        campaignId: result.campaignId,
        bounceType: result.bounceType,
        contactStatusUpdated: result.contactStatusUpdated,
        engagementRecalculated: result.engagementRecalculated,
        error: result.error
      })
    }

    // Process all unprocessed bounces
    if (processAll) {
      console.log(`📧 Processing all unprocessed bounces for user ${user.id}`)

      // Get all incoming emails that haven't been classified yet
      const { data: emails, error: emailsError } = await supabase
        .from('incoming_emails')
        .select('id')
        .eq('user_id', user.id)
        .or('classification_status.is.null,classification_status.eq.unclassified')
        .order('date_received', { ascending: false })
        .limit(100)

      if (emailsError) {
        throw new Error(`Failed to fetch emails: ${emailsError.message}`)
      }

      if (!emails || emails.length === 0) {
        return NextResponse.json({
          success: true,
          processed: 0,
          bounces: 0,
          message: 'No unprocessed emails found'
        })
      }

      // Process each email
      const results = {
        processed: 0,
        bounces: 0,
        errors: [] as string[]
      }

      for (const email of emails) {
        try {
          const result = await bounceProcessor.processIncomingEmail(email.id)
          results.processed++

          if (result.bounceDetected) {
            results.bounces++
          }

          if (result.error) {
            results.errors.push(`Email ${email.id}: ${result.error}`)
          }
        } catch (error) {
          results.errors.push(
            `Email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      return NextResponse.json({
        success: true,
        processed: results.processed,
        bounces: results.bounces,
        errors: results.errors.length > 0 ? results.errors : undefined
      })
    }

    return NextResponse.json(
      { error: 'Must provide emailId or set processAll to true' },
      { status: 400 }
    )

  } catch (error) {
    console.error('❌ Error processing bounces:', error)
    return NextResponse.json(
      {
        error: 'Failed to process bounces',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
