import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { BulkPersonalizationService } from '@/lib/bulk-personalization'

// GET /api/ai/bulk-personalize/[id]/results - Get job results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') as 'success' | 'failed' | undefined
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const format = url.searchParams.get('format') // 'csv' for export

    const bulkService = new BulkPersonalizationService()
    
    // Check if job exists and user owns it
    const job = await bulkService.getJobStatus(id, supabase)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Handle CSV export
    if (format === 'csv') {
      try {
        const csvContent = await bulkService.exportJobResults(id, supabase)
        
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=\"bulk-personalization-${id}.csv\"`
          }
        })
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to export results' },
          { status: 500 }
        )
      }
    }

    // Get paginated results
    const { results, total } = await bulkService.getJobResults(
      id,
      { status, limit, offset },
      supabase
    )

    return NextResponse.json({
      success: true,
      data: {
        results,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        },
        job_info: {
          id: job.id,
          name: job.name,
          status: job.status,
          progress: job.progress
        }
      }
    })

  } catch (error) {
    console.error('Get bulk personalization results error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}