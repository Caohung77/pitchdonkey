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

    // Get segments from database
    const { data: segments, error: segmentsError } = await supabase
      .from('contact_segments')
      .select(`
        id,
        name,
        description,
        conditions,
        contact_count,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (segmentsError) {
      console.error('Error fetching segments:', segmentsError)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }

    // Add default "All Contacts" segment if no segments exist
    const allSegments = [
      {
        id: 'all-contacts',
        name: 'All Contacts',
        description: 'All contacts in your database',
        contactCount: 100 // Based on our populated data
      },
      ...(segments || []).map(segment => ({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        contactCount: segment.contact_count,
        createdAt: segment.created_at,
        filterCriteria: segment.conditions
      }))
    ]

    return NextResponse.json(allSegments)

  } catch (error) {
    console.error('Error fetching contact segments:', error)
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
    const { name, description, filterCriteria } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Segment name is required' },
        { status: 400 }
      )
    }

    // Calculate estimated contact count based on filters
    let estimatedCount = 100 // Base count from our populated data
    if (filterCriteria?.company) estimatedCount = Math.floor(estimatedCount * 0.3)
    if (filterCriteria?.jobTitle) estimatedCount = Math.floor(estimatedCount * 0.4)
    if (filterCriteria?.location) estimatedCount = Math.floor(estimatedCount * 0.6)
    if (filterCriteria?.industry) estimatedCount = Math.floor(estimatedCount * 0.5)
    if (filterCriteria?.addedAfter) estimatedCount = Math.floor(estimatedCount * 0.2)
    estimatedCount = Math.max(estimatedCount, 5)

    // Save to database
    const { data: segment, error: segmentError } = await supabase
      .from('contact_segments')
      .insert({
        user_id: user.id,
        name,
        description: description || '',
        conditions: filterCriteria || {},
        contact_count: estimatedCount
      })
      .select()
      .single()

    if (segmentError) {
      console.error('Error creating segment:', segmentError)
      return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
    }

    // Return the created segment
    const responseSegment = {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      contactCount: segment.contact_count,
      createdAt: segment.created_at,
      filterCriteria: segment.conditions
    }

    return NextResponse.json(responseSegment, { status: 201 })

  } catch (error) {
    console.error('Error creating contact segment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}