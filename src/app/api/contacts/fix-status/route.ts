import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateContactEngagement } from '@/lib/contact-engagement'

/**
 * Fix Contact Status Endpoint
 *
 * Recalculates contact engagement status based on email_tracking records.
 * This fixes contacts that show "not_contacted" even though emails were sent.
 *
 * Usage:
 * POST /api/contacts/fix-status
 *
 * Body parameters:
 * - contactIds: string[] (optional) - specific contact IDs to fix
 * - all: boolean (optional) - fix all contacts
 * - batchSize: number (optional) - number of contacts to process per batch (default: 50)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactIds, all = false, batchSize = 50 } = body

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let targetContactIds: string[] = []

    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      // Fix specific contacts
      targetContactIds = contactIds
      console.log(`🔧 Fixing ${contactIds.length} specific contacts`)
    } else if (all) {
      // Fix all contacts with "not_contacted" status that have email tracking records
      console.log(`🔧 Finding all contacts with incorrect status...`)

      const { data: contactsToFix, error: queryError } = await supabase
        .from('contacts')
        .select('id')
        .eq('engagement_status', 'not_contacted')

      if (queryError) {
        console.error('Error querying contacts:', queryError)
        return NextResponse.json({
          success: false,
          error: 'Failed to query contacts',
          details: queryError.message
        }, { status: 500 })
      }

      if (!contactsToFix || contactsToFix.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No contacts need fixing',
          fixed: 0
        })
      }

      // Check which of these contacts actually have email_tracking records
      const contactsWithTracking: string[] = []

      for (const contact of contactsToFix) {
        const { data: tracking } = await supabase
          .from('email_tracking')
          .select('id')
          .eq('contact_id', contact.id)
          .limit(1)

        if (tracking && tracking.length > 0) {
          contactsWithTracking.push(contact.id)
        }
      }

      targetContactIds = contactsWithTracking
      console.log(`📊 Found ${targetContactIds.length} contacts with incorrect status`)
    } else {
      return NextResponse.json({
        success: false,
        error: 'Must provide either contactIds array or all: true'
      }, { status: 400 })
    }

    if (targetContactIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts need fixing',
        fixed: 0
      })
    }

    // Process contacts in batches
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    console.log(`🔄 Processing ${targetContactIds.length} contacts in batches of ${batchSize}`)

    for (let i = 0; i < targetContactIds.length; i += batchSize) {
      const batch = targetContactIds.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(targetContactIds.length / batchSize)}`)

      await Promise.all(
        batch.map(async (contactId) => {
          try {
            const result = await recalculateContactEngagement(supabase, contactId)

            if (result) {
              // Update contact with new engagement data
              const { error: updateError } = await supabase
                .from('contacts')
                .update({
                  engagement_status: result.status,
                  engagement_score: result.score,
                  engagement_sent_count: result.sentCount,
                  engagement_open_count: result.openCount,
                  engagement_click_count: result.clickCount,
                  engagement_reply_count: result.replyCount,
                  engagement_bounce_count: result.bounceCount,
                  engagement_last_positive_at: result.lastPositiveAt,
                  updated_at: new Date().toISOString()
                })
                .eq('id', contactId)

              if (updateError) {
                console.error(`❌ Failed to update contact ${contactId}:`, updateError)
                results.failed++
                results.errors.push({
                  contactId,
                  error: updateError.message
                })
              } else {
                console.log(`✅ Fixed contact ${contactId}: ${result.status} (score: ${result.score})`)
                results.success++
              }
            } else {
              console.error(`❌ Failed to calculate engagement for contact ${contactId}`)
              results.failed++
              results.errors.push({
                contactId,
                error: 'Failed to calculate engagement'
              })
            }
          } catch (err) {
            console.error(`❌ Error processing contact ${contactId}:`, err)
            results.failed++
            results.errors.push({
              contactId,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        })
      )

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < targetContactIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`🎉 Contact status fix completed:`)
    console.log(`   ✅ Success: ${results.success}`)
    console.log(`   ❌ Failed: ${results.failed}`)

    return NextResponse.json({
      success: true,
      message: `Fixed ${results.success} contacts`,
      results: {
        total: targetContactIds.length,
        success: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10) // Return first 10 errors only
      }
    })

  } catch (error) {
    console.error('❌ Error in fix contact status API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
