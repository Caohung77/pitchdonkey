import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactSegmentationService } from '@/lib/contact-segmentation'

// GET /api/contacts/segments/stats - Get segment statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const segmentService = new ContactSegmentationService()
    const stats = await segmentService.getSegmentStats(user.id)

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Get segment stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}