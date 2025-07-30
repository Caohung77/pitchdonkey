import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactSegmentationService } from '@/lib/contact-segmentation'
import { z } from 'zod'

const updateSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  description: z.string().optional(),
  conditions: z.array(z.object({
    rules: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'greater_than', 'less_than', 'in', 'not_in']),
      value: z.union([z.string(), z.array(z.string()), z.number()])
    })),
    logic: z.enum(['AND', 'OR'])
  })).optional(),
  logic: z.enum(['AND', 'OR']).optional(),
  is_dynamic: z.boolean().optional()
})

// GET /api/contacts/segments/[id] - Get a specific segment
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

    const segmentService = new ContactSegmentationService()
    const segment = await segmentService.getSegment(params.id, user.id)

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: segment
    })

  } catch (error) {
    console.error('Get segment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/contacts/segments/[id] - Update a segment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateSegmentSchema.parse(body)

    const segmentService = new ContactSegmentationService()
    const segment = await segmentService.updateSegment(params.id, user.id, validatedData)

    return NextResponse.json({
      success: true,
      data: segment,
      message: 'Segment updated successfully'
    })

  } catch (error) {
    console.error('Update segment error:', error)
    
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/segments/[id] - Delete a segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const segmentService = new ContactSegmentationService()
    await segmentService.deleteSegment(params.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Segment deleted successfully'
    })

  } catch (error) {
    console.error('Delete segment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}