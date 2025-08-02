import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const formattedLists = (lists || []).map(list => ({
      id: list.id,
      name: list.name,
      description: list.description,
      contactCount: list.contact_ids ? list.contact_ids.length : 0,
      tags: list.tags || [],
      isFavorite: list.is_favorite,
      createdAt: list.created_at,
      type: 'list' // To distinguish from segments
    }))

    return NextResponse.json(formattedLists)

  } catch (error) {
    console.error('Error fetching contact lists:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, contactIds, tags } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      )
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
      if (listError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A list with this name already exists' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to create contact list' }, { status: 500 })
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

    return NextResponse.json(responseList, { status: 201 })

  } catch (error) {
    console.error('Error creating contact list:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}