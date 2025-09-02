import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: listId } = await params

    // Get the contact list first to verify ownership and get contact IDs
    const { data: contactList, error: listError } = await supabase
      .from('contact_lists')
      .select('id, name, contact_ids')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single()

    if (listError) {
      console.error('Error fetching contact list:', listError)
      return NextResponse.json(
        { error: 'Contact list not found' },
        { status: 404 }
      )
    }

    if (!contactList.contact_ids || contactList.contact_ids.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Get the actual contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        email,
        company,
        position,
        phone,
        website,
        status,
        tags,
        created_at,
        updated_at,
        enrichment_status
      `)
      .in('id', contactList.contact_ids)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: contacts || []
    })

  } catch (error) {
    console.error('Error in GET /api/contacts/lists/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: listId } = await params
    const body = await request.json()
    const { contact_ids } = body

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    // Get the current contact list
    const { data: contactList, error: listError } = await supabase
      .from('contact_lists')
      .select('id, contact_ids')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single()

    if (listError) {
      console.error('Error fetching contact list:', listError)
      return NextResponse.json(
        { error: 'Contact list not found' },
        { status: 404 }
      )
    }

    // Verify that all contact IDs belong to the user
    const { data: userContacts, error: verifyError } = await supabase
      .from('contacts')
      .select('id')
      .in('id', contact_ids)
      .eq('user_id', user.id)

    if (verifyError) {
      console.error('Error verifying contacts:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify contacts' },
        { status: 500 }
      )
    }

    const validContactIds = userContacts?.map(c => c.id) || []
    const invalidIds = contact_ids.filter(id => !validContactIds.includes(id))

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid contact IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Merge with existing contact IDs (avoid duplicates)
    const currentContactIds = contactList.contact_ids || []
    const newContactIds = [...new Set([...currentContactIds, ...contact_ids])]

    // Update the contact list
    const { error: updateError } = await supabase
      .from('contact_lists')
      .update({
        contact_ids: newContactIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating contact list:', updateError)
      return NextResponse.json(
        { error: 'Failed to add contacts to list' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${contact_ids.length} contacts added to list`,
      added_count: contact_ids.length,
      total_contacts: newContactIds.length
    })

  } catch (error) {
    console.error('Error in POST /api/contacts/lists/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: listId } = await params
    const body = await request.json()
    const { contact_ids } = body

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    // Get the current contact list
    const { data: contactList, error: listError } = await supabase
      .from('contact_lists')
      .select('id, contact_ids')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single()

    if (listError) {
      console.error('Error fetching contact list:', listError)
      return NextResponse.json(
        { error: 'Contact list not found' },
        { status: 404 }
      )
    }

    // Remove the specified contact IDs
    const currentContactIds = contactList.contact_ids || []
    const updatedContactIds = currentContactIds.filter(id => !contact_ids.includes(id))

    // Update the contact list
    const { error: updateError } = await supabase
      .from('contact_lists')
      .update({
        contact_ids: updatedContactIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating contact list:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove contacts from list' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${contact_ids.length} contacts removed from list`,
      removed_count: contact_ids.length,
      remaining_contacts: updatedContactIds.length
    })

  } catch (error) {
    console.error('Error in DELETE /api/contacts/lists/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})