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

    // Build the query
    let query = supabase
      .from('incoming_emails')
      .select(`
        id,
        from_address,
        to_address,
        subject,
        date_received,
        classification_status,
        processing_status,
        classification_confidence,
        text_content,
        html_content,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('date_received', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add classification filter if specified
    if (classification && classification !== 'all') {
      query = query.eq('classification_status', classification)
    }

    // Add search filter if specified
    if (search) {
      query = query.or(`from_address.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    const { data: emails, error, count } = await query

    if (error) {
      console.error('Error fetching inbox emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails',
        code: 'FETCH_ERROR'
      }, { status: 500 })
    }

    // Get classification stats for the user
    const { data: stats } = await supabase
      .from('incoming_emails')
      .select('classification_status')
      .eq('user_id', user.id)

    const classificationStats = stats?.reduce((acc, email) => {
      acc[email.classification_status] = (acc[email.classification_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const response = NextResponse.json({
      success: true,
      emails: emails || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
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