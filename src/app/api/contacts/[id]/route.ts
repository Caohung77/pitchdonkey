import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { ContactService } from '@/lib/contacts'
import { updateContactSchema } from '@/lib/validations'

export const GET = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params

    const contactService = new ContactService()
    const contact = await contactService.getContact(contactId, user.id)

    if (!contact) {
      return createSuccessResponse({ error: 'Contact not found' }, 404)
    }

    return createSuccessResponse({ contact })

  } catch (error) {
    console.error('Get contact error:', error)
    return handleApiError(error)
  }
})

export const PUT = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params
    const body = await request.json()
    
    console.log('PUT /api/contacts/[id] - Updating contact:', contactId, body)
    
    // Validate input
    const validatedData = updateContactSchema.parse(body)

    const contactService = new ContactService()
    const contact = await contactService.updateContact(contactId, user.id, validatedData)

    return createSuccessResponse({ contact }, 200)

  } catch (error) {
    console.error('Update contact error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params

    const contactService = new ContactService()
    await contactService.deleteContact(contactId, user.id)

    return createSuccessResponse({ message: 'Contact deleted successfully' })

  } catch (error) {
    console.error('Delete contact error:', error)
    return handleApiError(error)
  }
})