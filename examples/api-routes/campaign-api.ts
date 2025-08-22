// Example: Campaign API Route Pattern
// Shows how to implement CRUD operations for email campaigns

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { campaignSchema } from '@/lib/validations'
import { CampaignUtils } from '@/lib/campaigns'

// GET /api/campaigns - List user's campaigns
export async function GET(request: NextRequest) {
  try {
    // PATTERN: Always authenticate first
    const user = await requireAuth()
    
    // PATTERN: Extract query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // PATTERN: Use server-side Supabase client
    const supabase = createServerSupabaseClient()
    
    // PATTERN: Build query with optional filters
    let query = supabase
      .from('campaigns')
      .select(`
        *,
        campaign_contacts!inner(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', code: 'FETCH_ERROR' },
        { status: 500 }
      )
    }
    
    // PATTERN: Return consistent response format
    return NextResponse.json({
      data,
      meta: {
        total: count,
        limit,
        offset,
        hasMore: count ? count > offset + limit : false
      }
    })
    
  } catch (error) {
    console.error('Campaign API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    // PATTERN: Validate request body with Zod
    const body = await request.json()
    const validatedData = campaignSchema.parse(body)
    
    // PATTERN: Check user permissions and plan limits
    const hasPermission = await checkUserPermissions(user.id, 'campaigns', 'create')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Plan limit reached for campaigns', code: 'PLAN_LIMIT_EXCEEDED' },
        { status: 403 }
      )
    }
    
    // PATTERN: Validate business logic
    const validation = CampaignUtils.validateCampaignForLaunch(validatedData)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Campaign validation failed', 
          details: validation.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
    
    const supabase = createServerSupabaseClient()
    
    // PATTERN: Database transaction for complex operations
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        ...validatedData,
        user_id: user.id,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json(
        { error: 'Failed to create campaign', code: 'CREATE_ERROR' },
        { status: 500 }
      )
    }
    
    // PATTERN: Update user usage statistics
    await updateUserUsageStats(user.id, 'campaigns', 1)
    
    return NextResponse.json({ data: campaign }, { status: 201 })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      // PATTERN: Handle validation errors specifically
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
    
    console.error('Campaign creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// Helper function for updating usage stats
async function updateUserUsageStats(userId: string, resource: string, increment: number) {
  const supabase = createServerSupabaseClient()
  
  // PATTERN: Atomic counter updates
  const { error } = await supabase.rpc('increment_usage_stat', {
    user_id: userId,
    stat_name: `${resource}_count`,
    increment_by: increment
  })
  
  if (error) {
    console.error('Error updating usage stats:', error)
    // Don't fail the main operation for stats updates
  }
}

// Export type for use in other files
export type CampaignAPIResponse = {
  data: Campaign[]
  meta: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}