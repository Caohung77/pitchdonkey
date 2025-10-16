import { NextRequest, NextResponse } from 'next/server'
import { addSecurityHeaders, withAuth } from '@/lib/auth-middleware'
import { recalculateContactEngagement } from '@/lib/contact-engagement'

/**
 * POST /api/contacts/[id]/flag-status
 * Manually flag a contact with bad engagement status (e.g., unsubscribe, bounce)
 */
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: contactId } = await params
    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { reason, senderEmail } = body as {
      reason?: 'unsubscribe' | 'bounce' | 'complaint',
      senderEmail?: string
    }

    console.log(`🚩 Flagging contact ${contactId} as bad engagement status`, { reason })

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email, engagement_status')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const updateData: any = {
      engagement_status: 'bad',
      engagement_score: -10, // Manual flag pushes score below 0 to render red states consistently
      engagement_updated_at: now,
      updated_at: now
    }

    // Set appropriate timestamp based on reason
    switch (reason) {
      case 'unsubscribe':
        updateData.unsubscribed_at = now
        break
      case 'bounce':
        updateData.bounced_at = now
        break
      case 'complaint':
        updateData.complained_at = now
        break
      default:
        // Default to unsubscribe behavior
        updateData.unsubscribed_at = now
    }

    // Update contact
    const { error: updateError } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)

    if (updateError) {
      console.error('Failed to update contact flag status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update contact status' },
        { status: 500 }
      )
    }

    console.log(`✅ Updated contact ${contactId} with bad status (score set to -10)`)
 
    // Return success immediately without recalculation to preserve negative score
    return addSecurityHeaders(NextResponse.json({
      success: true,
      data: {
        contactId,
        engagement_status: 'bad',
        engagement_score: -10,
        reason
      }
    }))
  } catch (error) {
    console.error('Flag status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
