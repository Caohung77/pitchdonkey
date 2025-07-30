import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactSegmentationService } from '@/lib/contact-segmentation'

// GET /api/contacts/segments/[id]/contacts - Get contacts in a segment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const sortBy = url.searchParams.get('sortBy') || 'created_at'
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const segmentService = new ContactSegmentationService()
    const result = await segmentService.getSegmentContacts(params.id, user.id, {
      page,
      limit,
      sortBy,
      sortOrder
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Get segment contacts error:', error)
    
    if (error instanceof Error && error.message === 'Segment not found') {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}