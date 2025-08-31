import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

// POST /api/contacts/bulk-list-operations - Add contacts to lists or create new list
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const body = await request.json()
    const { contactIds, listIds, newListName, newListDescription } = body

    // Validate required fields
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate that we have either existing list IDs or new list details
    if ((!listIds || listIds.length === 0) && !newListName) {
      return NextResponse.json(
        { error: 'Either existing list IDs or new list name is required' },
        { status: 400 }
      )
    }

    // Verify that all contacts belong to the user
    const { data: userContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', contactIds)

    if (contactsError) {
      console.error('Error verifying user contacts:', contactsError)
      return NextResponse.json(
        { error: 'Failed to verify contacts' },
        { status: 500 }
      )
    }

    if (userContacts.length !== contactIds.length) {
      return NextResponse.json(
        { error: 'Some contacts do not belong to this user' },
        { status: 403 }
      )
    }

    let targetListIds = listIds || []

    // Create new list if requested
    if (newListName) {
      const { data: newList, error: createError } = await supabase
        .from('contact_lists')
        .insert({
          user_id: user.id,
          name: newListName,
          description: newListDescription || '',
          contact_ids: contactIds
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating new list:', createError)
        if (createError.code === '23505') {
          return NextResponse.json(
            { error: 'A list with this name already exists' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: 'Failed to create new list' },
          { status: 500 }
        )
      }

      targetListIds.push(newList.id)
    }

    // Add contacts to existing lists
    if (targetListIds.length > 0) {
      // Verify that all lists belong to the user
      const { data: userLists, error: listsError } = await supabase
        .from('contact_lists')
        .select('id, name, contact_ids')
        .eq('user_id', user.id)
        .in('id', targetListIds)

      if (listsError) {
        console.error('Error verifying user lists:', listsError)
        return NextResponse.json(
          { error: 'Failed to verify lists' },
          { status: 500 }
        )
      }

      if (userLists.length !== targetListIds.length) {
        return NextResponse.json(
          { error: 'Some lists do not belong to this user' },
          { status: 403 }
        )
      }

      // Update each list to include the new contacts
      for (const list of userLists) {
        const existingContactIds = list.contact_ids || []
        const newContactIds = contactIds.filter(id => !existingContactIds.includes(id))
        
        if (newContactIds.length > 0) {
          const updatedContactIds = [...existingContactIds, ...newContactIds]
          
          const { error: updateError } = await supabase
            .from('contact_lists')
            .update({
              contact_ids: updatedContactIds,
              updated_at: new Date().toISOString()
            })
            .eq('id', list.id)
            .eq('user_id', user.id)

          if (updateError) {
            console.error(`Error updating list ${list.id}:`, updateError)
            return NextResponse.json(
              { error: `Failed to update list: ${list.name}` },
              { status: 500 }
            )
          }
        }
      }
    }

    // Return success response
    const response = {
      success: true,
      message: `Successfully added ${contactIds.length} contacts to ${targetListIds.length} list(s)`,
      data: {
        contactCount: contactIds.length,
        listCount: targetListIds.length,
        newListCreated: !!newListName
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error in bulk list operations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})