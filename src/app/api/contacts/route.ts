import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ContactService } from '@/lib/contacts'
import { contactSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const contactService = new ContactService()
    const result = await contactService.getUserContacts(user.id, {
      page,
      limit,
      search,
      status,
      tags,
      sortBy,
      sortOrder
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Get contacts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validatedData = contactSchema.parse(body)

    const contactService = new ContactService()
    const contact = await contactService.createContact(user.id, validatedData)

    return NextResponse.json({
      success: true,
      data: contact
    }, { status: 201 })

  } catch (error) {
    console.error('Create contact error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      if (error.message.includes('Validation failed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}