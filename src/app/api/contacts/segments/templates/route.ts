import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactSegmentationService } from '@/lib/contact-segmentation'

// GET /api/contacts/segments/templates - Get segment templates and field info
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type') // 'templates' or 'fields'

    if (type === 'fields') {
      const fields = ContactSegmentationService.getAvailableFields()
      return NextResponse.json({
        success: true,
        data: fields
      })
    }

    // Default to templates
    const templates = ContactSegmentationService.getSegmentTemplates()
    return NextResponse.json({
      success: true,
      data: templates
    })

  } catch (error) {
    console.error('Get segment templates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}