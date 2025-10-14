import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

// GET /api/inbox/emails - Get user's inbox emails
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 100, 60000) // 100 requests per minute

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const classification = searchParams.get('classification')
    const search = searchParams.get('search')
    const accountId = searchParams.get('account_id')

    // Build the query with JOINs for email account, campaign, and contact info
    // IMPORTANT: Use LEFT join for email_accounts instead of INNER to include emails
    // even if the email account relationship has issues. The email_account_id filter
    // will handle account-specific queries.
    let query = supabase
      .from('incoming_emails')
      .select(`
        id,
        email_account_id,
        from_address,
        to_address,
        subject,
        date_received,
        message_id,
        thread_id,
        gmail_message_id,
        classification_status,
        processing_status,
        classification_confidence,
        text_content,
        html_content,
        contact_id,
        ai_summary,
        created_at,
        updated_at,
        email_accounts (
          id,
          email,
          provider,
          assigned_agent:ai_personas!email_accounts_assigned_persona_id_fkey(
            id,
            name
          )
        ),
        email_replies (
          campaign_id,
          contact_id,
          campaigns (
            id,
            name
          ),
          contacts (
            id,
            first_name,
            last_name,
            email
          )
        ),
        reply_jobs!reply_jobs_incoming_email_id_fkey (
          id,
          status,
          draft_subject,
          scheduled_at,
          agent:ai_personas!reply_jobs_agent_id_fkey(
            id,
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('date_received', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add email account filter if specified
    if (accountId && accountId !== 'all') {
      query = query.eq('email_account_id', accountId)
    }

    // Add classification filter if specified
    if (classification && classification !== 'all') {
      query = query.eq('classification_status', classification)
    }

    // Add search filter if specified
    if (search) {
      query = query.or(`from_address.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    // Execute query
    const { data: emails, error } = await query

    // Get total count separately for pagination
    let totalCount = 0
    if (!error) {
      const countQuery = supabase
        .from('incoming_emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null)

      if (accountId && accountId !== 'all') {
        countQuery.eq('email_account_id', accountId)
      }
      if (classification && classification !== 'all') {
        countQuery.eq('classification_status', classification)
      }
      if (search) {
        countQuery.or(`from_address.ilike.%${search}%,subject.ilike.%${search}%`)
      }

      const { count } = await countQuery
      totalCount = count || 0
    }

    // Enhanced debugging for mailbox display issues
    console.log('📧 Inbox query results:', {
      user_id: user.id,
      account_id: accountId || 'all',
      classification: classification || 'all',
      search: search || 'none',
      total_count: totalCount,
      returned_emails: emails?.length || 0,
      limit,
      offset
    })

    if (error) {
      console.error('Error fetching inbox emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails',
        code: 'FETCH_ERROR'
      }, { status: 500 })
    }

    // Build contact lookup for linked emails
    let contactMap: Record<string, any> = {}
    if (emails && emails.length > 0) {
      const contactIds = Array.from(
        new Set(
          emails
            .map(email => email.contact_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      if (contactIds.length > 0) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', contactIds)

        if (contactsData && contactsData.length > 0) {
          contactMap = contactsData.reduce<Record<string, any>>((acc, contact) => {
            acc[contact.id] = contact
            return acc
          }, {})
        }
      }
    }

    const enrichedEmails = (emails || []).map(email => ({
      ...email,
      contact: email.contact_id ? contactMap[email.contact_id] || null : null
    }))

    // Get classification stats for the user
    const { data: stats } = await supabase
      .from('incoming_emails')
      .select('classification_status')
      .eq('user_id', user.id)
      .is('archived_at', null)

    const classificationStats = stats?.reduce((acc, email) => {
      acc[email.classification_status] = (acc[email.classification_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const response = NextResponse.json({
      success: true,
      emails: enrichedEmails,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: totalCount > offset + limit
      },
      stats: {
        total: stats?.length || 0,
        classifications: classificationStats
      }
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error in inbox emails API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})

// PATCH /api/inbox/emails - Update email status (mark as read, archive, etc.)
export const PATCH = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 50, 60000) // 50 updates per minute

    const body = await request.json()
    const { emailIds, action, value } = body

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Email IDs are required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    let updateData: any = {}

    switch (action) {
      case 'mark_read':
        updateData.processing_status = 'completed'
        break
      case 'mark_unread':
        updateData.processing_status = 'pending'
        break
      case 'archive':
        updateData.archived_at = new Date().toISOString()
        break
      case 'unarchive':
        updateData.archived_at = null
        break
      case 'classify':
        if (!value) {
          return NextResponse.json({
            success: false,
            error: 'Classification value is required',
            code: 'VALIDATION_ERROR'
          }, { status: 400 })
        }
        updateData.classification_status = value
        updateData.processing_status = 'completed'
        updateData.processed_at = new Date().toISOString()
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          code: 'VALIDATION_ERROR'
        }, { status: 400 })
    }

    // Update the emails
    const { data: updatedEmails, error } = await supabase
      .from('incoming_emails')
      .update(updateData)
      .in('id', emailIds)
      .eq('user_id', user.id) // Ensure user can only update their own emails
      .select()

    if (error) {
      console.error('Error updating emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update emails',
        code: 'UPDATE_ERROR'
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      message: `Successfully ${action.replace('_', ' ')}ed ${emailIds.length} email(s)`,
      updatedEmails: updatedEmails || []
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error in inbox emails update API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})
