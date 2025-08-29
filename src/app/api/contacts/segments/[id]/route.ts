import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/contacts/segments/[id] - Get a specific segment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle special "all-contacts" segment
    if (params.id === 'all-contacts') {
      return NextResponse.json({
        success: true,
        data: {
          id: 'all-contacts',
          name: 'All Contacts',
          description: 'All contacts in your database',
          contactCount: 100,
          createdAt: new Date().toISOString()
        }
      })
    }

    // Get segment from database
    const { data: segment, error: segmentError } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        contactCount: segment.contact_count,
        createdAt: segment.created_at,
        filterCriteria: segment.conditions
      }
    })

  } catch (error) {
    console.error('Get segment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/segments/[id] - Delete a segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Don't allow deleting the default "all-contacts" segment
    if (params.id === 'all-contacts') {
      return NextResponse.json({ error: 'Cannot delete default segment' }, { status: 400 })
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('contact_segments')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting segment:', deleteError)
      return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
    }

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