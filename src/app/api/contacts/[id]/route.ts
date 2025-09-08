import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { ContactService } from '@/lib/contacts'
import { updateContactSchema } from '@/lib/validations'

// PUT /api/contacts/[id] - Update a single contact
export async function PUT(request: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    const contactId = ctx?.params?.id
    
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateContactSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid contact data', 
        details: validationResult.error.errors 
      }, { status: 400 })
    }

    const service = new ContactService()
    const updatedContact = await service.updateContact(contactId, user.id, validationResult.data)
    
    if (!updatedContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      success: true,
      data: updatedContact,
      message: 'Contact updated successfully'
    })

  } catch (error: any) {
    console.error('Contact update error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to update contact' 
    }, { status: 500 })
  }
}

// DELETE /api/contacts/[id] - Delete a single contact and prune from all lists
export async function DELETE(request: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    const contactId = ctx?.params?.id
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    const service = new ContactService()
    const result = await service.bulkDeleteContacts([contactId], user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to delete contact' }, { status: 500 })
  }
}

