import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'

const getRepliesSchema = z.object({
  campaignId: z.string().optional(),
  replyType: z.enum(['bounce', 'auto_reply', 'human_reply', 'unsubscribe', 'spam']).optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  requiresReview: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
})

// GET /api/replies - Get email replies with filtering
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams)
    
    // Convert string params to appropriate types
    if (params.requiresReview) {
      params.requiresReview = params.requiresReview === 'true'
    }
    if (params.limit) {
      params.limit = parseInt(params.limit)
    }
    if (params.offset) {
      params.offset = parseInt(params.offset)
    }

    const validatedParams = getRepliesSchema.parse(params)

    // Build query
    let query = supabase
      .from('email_replies')
      .select(`
        *,
        incoming_emails (
          subject,
          from_address,
          date_received,
          text_content
        ),
        campaigns (
          name
        ),
        contacts (
          first_name,
          last_name,
          email
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (validatedParams.campaignId) {
      query = query.eq('campaign_id', validatedParams.campaignId)
    }
    
    if (validatedParams.replyType) {
      query = query.eq('reply_type', validatedParams.replyType)
    }
    
    if (validatedParams.sentiment) {
      query = query.eq('sentiment', validatedParams.sentiment)
    }
    
    if (validatedParams.requiresReview !== undefined) {
      query = query.eq('requires_human_review', validatedParams.requiresReview)
    }

    // Apply pagination
    query = query.range(validatedParams.offset, validatedParams.offset + validatedParams.limit - 1)

    const { data: replies, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        replies,
        pagination: {
          total: count,
          limit: validatedParams.limit,
          offset: validatedParams.offset,
          hasMore: count > validatedParams.offset + validatedParams.limit
        }
      }
    })

  } catch (error) {
    console.error('❌ Error getting replies:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}