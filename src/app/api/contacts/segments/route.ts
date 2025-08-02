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

    // For now, return mock segments
    // In a real implementation, you'd query a contact_segments table
    const mockSegments = [
      {
        id: 'all-contacts',
        name: 'All Contacts',
        description: 'All contacts in your database',
        contactCount: 1250
      },
      {
        id: 'tech-leads',
        name: 'Tech Industry Leads',
        description: 'Contacts from technology companies',
        contactCount: 450
      },
      {
        id: 'marketing-directors',
        name: 'Marketing Directors',
        description: 'Marketing decision makers',
        contactCount: 180
      },
      {
        id: 'recent-imports',
        name: 'Recent Imports',
        description: 'Contacts added in the last 30 days',
        contactCount: 75
      },
      {
        id: 'high-value',
        name: 'High Value Prospects',
        description: 'Contacts from companies with 100+ employees',
        contactCount: 320
      }
    ]

    // In a real implementation, you might do something like:
    /*
    const { data: segments, error } = await supabase
      .from('contact_segments')
      .select(`
        id,
        name,
        description,
        filter_criteria,
        created_at,
        contacts!inner(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    */

    return NextResponse.json(mockSegments)

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
    let estimatedCount = 1250 // Base count
    if (filterCriteria?.company) estimatedCount = Math.floor(estimatedCount * 0.3)
    if (filterCriteria?.jobTitle) estimatedCount = Math.floor(estimatedCount * 0.4)
    if (filterCriteria?.location) estimatedCount = Math.floor(estimatedCount * 0.6)
    if (filterCriteria?.industry) estimatedCount = Math.floor(estimatedCount * 0.5)
    if (filterCriteria?.addedAfter) estimatedCount = Math.floor(estimatedCount * 0.2)
    estimatedCount = Math.max(estimatedCount, 10)

    // Mock response for now - in production this would save to database
    const mockSegment = {
      id: `segment_${Date.now()}`,
      name,
      description: description || '',
      contactCount: estimatedCount,
      createdAt: new Date().toISOString(),
      filterCriteria: filterCriteria || {}
    }

    return NextResponse.json(mockSegment, { status: 201 })

  } catch (error) {
    console.error('Error creating contact segment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}