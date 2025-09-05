import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get contact lists from database
    const { data: lists, error: listsError } = await supabase
      .from('contact_lists')
      .select(`
        id,
        name,
        description,
        contact_ids,
        tags,
        is_favorite,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (listsError) {
      console.error('Error fetching contact lists:', listsError)
      return NextResponse.json({ error: 'Failed to fetch contact lists' }, { status: 500 })
    }

    // Format the response with contact counts
    // Compute counts based on existing contacts to avoid stale numbers
    const formattedLists = [] as any[]
    for (const list of lists || []) {
      let count = 0
      if (list.contact_ids && list.contact_ids.length > 0) {
        const { count: existingCount } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('id', list.contact_ids)
        count = existingCount || 0
      }

      formattedLists.push({
        id: list.id,
        name: list.name,
        description: list.description,
        contactCount: count,
        tags: list.tags || [],
        isFavorite: list.is_favorite,
        createdAt: list.created_at,
        type: 'list'
      })
    }

    return NextResponse.json({
      success: true,
      data: formattedLists
    })

  } catch (error) {
    console.error('Error fetching contact lists:', error)
    return NextResponse.json({
      error: 'Failed to fetch contact lists',
      code: 'FETCH_ERROR'
    }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('Creating contact list for user:', user.id, user.email) // Debug log
    
    const body = await request.json()
    const { name, description, contactIds, tags } = body
    
    console.log('Request body:', { name, description, contactIds: contactIds?.length, tags: tags?.length }) // Debug log

    // Validate required fields
    if (!name) {
      throw new Error('List name is required')
    }

    // Save to database
    const { data: list, error: listError } = await supabase
      .from('contact_lists')
      .insert({
        user_id: user.id,
        name,
        description: description || '',
        contact_ids: contactIds || [],
        tags: tags || []
      })
      .select()
      .single()

    if (listError) {
      console.error('Error creating contact list:', listError)
      
      // More specific error handling
      if (listError.code === '23505') { // Unique constraint violation
        throw new Error('A list with this name already exists')
      }
      if (listError.code === '42P01') { // Table does not exist
        throw new Error('Contact lists table does not exist. Please create the table first.')
      }
      
      throw new Error(`Failed to create contact list: ${listError.message}`)
    }

    // Return the created list
    const responseList = {
      id: list.id,
      name: list.name,
      description: list.description,
      contactCount: list.contact_ids ? list.contact_ids.length : 0,
      tags: list.tags || [],
      isFavorite: list.is_favorite,
      createdAt: list.created_at,
      type: 'list'
    }

    return NextResponse.json({
      success: true,
      data: responseList
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating contact list:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create contact list',
      code: 'CREATE_ERROR'
    }, { status: 500 })
  }
})
