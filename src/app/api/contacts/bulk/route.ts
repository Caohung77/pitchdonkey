import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactService } from '@/lib/contacts'
import { bulkContactsSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validatedData = bulkContactsSchema.parse(body)

    const contactService = new ContactService()
    const result = await contactService.bulkCreateContacts(
      user.id, 
      validatedData.contacts,
      {
        skipDuplicates: validatedData.skip_duplicates,
        validateEmails: validatedData.validate_emails
      }
    )

    return NextResponse.json({
      success: true,
      data: result
    }, { status: 201 })

  } catch (error) {
    console.error('Bulk create contacts error:', error)
    
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contact_ids, action, data } = body

    if (!contact_ids || !Array.isArray(contact_ids) || !action) {
      return NextResponse.json(
        { error: 'contact_ids (array) and action are required' },
        { status: 400 }
      )
    }

    const contactService = new ContactService()

    switch (action) {
      case 'add_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array is required for add_tags action' },
            { status: 400 }
          )
        }
        await contactService.addTagsToContacts(contact_ids, user.id, data.tags)
        break

      case 'remove_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array is required for remove_tags action' },
            { status: 400 }
          )
        }
        await contactService.removeTagsFromContacts(contact_ids, user.id, data.tags)
        break

      case 'update_status':
        if (!data?.status) {
          return NextResponse.json(
            { error: 'status is required for update_status action' },
            { status: 400 }
          )
        }
        await contactService.bulkUpdateContactStatus(contact_ids, user.id, data.status)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: add_tags, remove_tags, update_status' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${action} completed successfully`
    })

  } catch (error) {
    console.error('Bulk update contacts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}