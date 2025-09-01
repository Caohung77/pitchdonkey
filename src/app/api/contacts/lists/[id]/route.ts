import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/contacts/lists/[id] - Get a specific contact list
export const GET = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: any }) => {
  try {
    const p = params && typeof params.then === 'function' ? await params : params
    const { id } = p || {}
    if (!id) {
      return NextResponse.json({ error: 'Missing list id' }, { status: 400 })
    }

    // Get list from database
    const { data: list, error: listError } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (listError || !list) {
      return NextResponse.json({ error: 'Contact list not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: list.id,
        name: list.name,
        description: list.description,
        contactCount: list.contact_ids ? list.contact_ids.length : 0,
        contact_ids: list.contact_ids || [],
        tags: list.tags || [],
        isFavorite: list.is_favorite,
        createdAt: list.created_at,
        type: 'list'
      }
    })

  } catch (error: any) {
    console.error('Get contact list error:', error)
    if (error?.code === '42P01') {
      return NextResponse.json({ error: 'contact_lists table missing' }, { status: 500 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// PUT /api/contacts/lists/[id] - Update a contact list
export const PUT = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = params
    const body = await request.json()
    const { name, description, contactIds, tags, isFavorite } = body

    // Update list in database
    const { data: list, error: listError } = await supabase
      .from('contact_lists')
      .update({
        name,
        description,
        contact_ids: contactIds,
        tags,
        is_favorite: isFavorite
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (listError) {
      console.error('Error updating contact list:', listError)
      if (listError.code === '23505') {
        return NextResponse.json({ error: 'A list with this name already exists' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to update contact list' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: list.id,
        name: list.name,
        description: list.description,
        contactCount: list.contact_ids ? list.contact_ids.length : 0,
        tags: list.tags || [],
        isFavorite: list.is_favorite,
        createdAt: list.created_at,
        type: 'list'
      }
    })

  } catch (error) {
    console.error('Update contact list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// DELETE /api/contacts/lists/[id] - Delete a contact list
export const DELETE = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = params

    // Delete from database
    const { error: deleteError } = await supabase
      .from('contact_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting contact list:', deleteError)
      return NextResponse.json({ error: 'Failed to delete contact list' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Contact list deleted successfully'
    })

  } catch (error) {
    console.error('Delete contact list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
