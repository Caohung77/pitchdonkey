import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { BulkPersonalizationService, bulkPersonalizationRequestSchema } from '@/lib/bulk-personalization'
import { z } from 'zod'

// POST /api/ai/bulk-personalize - Create a new bulk personalization job
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = bulkPersonalizationRequestSchema.parse(body)

    const bulkService = new BulkPersonalizationService()
    
    // Create the job
    const job = await bulkService.createJob(user.id, validatedData, supabase)

    // Start processing in background (don't await)
    bulkService.processJob(job.id, supabase).catch(error => {
      console.error(`Background job ${job.id} failed:`, error)
    })

    return NextResponse.json({
      success: true,
      data: job,
      message: 'Bulk personalization job created and started'
    })

  } catch (error) {
    console.error('Create bulk personalization job error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/ai/bulk-personalize - Get user's bulk personalization jobs
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const bulkService = new BulkPersonalizationService()
    
    const { jobs, total } = await bulkService.getUserJobs(
      user.id,
      { status: status || undefined, limit, offset },
      supabase
    )

    return NextResponse.json({
      success: true,
      data: {
        jobs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('Get bulk personalization jobs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}