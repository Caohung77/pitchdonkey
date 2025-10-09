import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/contacts/fix-bounced-status
 *
 * Retroactively fixes engagement status for contacts with bounced emails.
 * This endpoint:
 * 1. Finds all contacts with email_status = 'bounced' but engagement_status != 'bad'
 * 2. Updates their engagement_status to 'bad'
 * 3. Applies engagement score penalty (-50 points, minimum -100)
 *
 * Use this to fix historical data after implementing the new bounce tracking system.
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

    console.log(`🔧 Starting retroactive bounce status fix for user ${user.id}`)

    // Find all contacts with bounced emails but not marked as 'bad' engagement status
    const { data: bouncedContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email, engagement_score, email_status, engagement_status, bounced_at')
      .eq('user_id', user.id)
      .eq('email_status', 'bounced')
      .neq('engagement_status', 'bad')

    if (fetchError) {
      console.error('❌ Error fetching bounced contacts:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch bounced contacts', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!bouncedContacts || bouncedContacts.length === 0) {
      console.log('✅ No bounced contacts need status update')
      return NextResponse.json({
        success: true,
        message: 'No contacts need updating',
        updated: 0
      })
    }

    console.log(`📊 Found ${bouncedContacts.length} bounced contacts that need status update`)

    // Update each contact
    const updates = []
    const errors = []

    for (const contact of bouncedContacts) {
      try {
        const currentScore = contact.engagement_score || 0
        const penaltyScore = Math.max(-100, currentScore - 50) // -50 penalty, minimum -100

        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            engagement_status: 'bad',
            engagement_score: penaltyScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id)

        if (updateError) {
          console.error(`❌ Failed to update contact ${contact.email}:`, updateError)
          errors.push({
            contactId: contact.id,
            email: contact.email,
            error: updateError.message
          })
        } else {
          console.log(`✅ Updated ${contact.email}: score ${currentScore} → ${penaltyScore}, status → bad`)
          updates.push({
            contactId: contact.id,
            email: contact.email,
            oldScore: currentScore,
            newScore: penaltyScore,
            penalty: currentScore - penaltyScore
          })
        }
      } catch (error: any) {
        console.error(`❌ Error updating contact ${contact.email}:`, error)
        errors.push({
          contactId: contact.id,
          email: contact.email,
          error: error.message
        })
      }
    }

    console.log(`🎉 Retroactive fix complete: ${updates.length} updated, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updates.length} bounced contacts`,
      updated: updates.length,
      failed: errors.length,
      details: {
        updates: updates.slice(0, 10), // Return first 10 for debugging
        errors: errors.slice(0, 10)
      },
      summary: {
        totalProcessed: bouncedContacts.length,
        successfulUpdates: updates.length,
        failedUpdates: errors.length
      }
    })

  } catch (error: any) {
    console.error('❌ Retroactive bounce fix failed:', error)
    return NextResponse.json(
      { error: 'Failed to fix bounced statuses', details: error.message },
      { status: 500 }
    )
  }
}
