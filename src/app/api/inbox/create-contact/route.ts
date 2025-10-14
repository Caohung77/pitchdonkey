import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { ContactService } from '@/lib/contacts'

interface CreateContactPayload {
  emailId?: string
  emailAddress?: string
  first_name?: string
  last_name?: string
  tags?: string[]
}

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const body = (await request.json()) as CreateContactPayload
    const emailAddress = body.emailAddress?.trim().toLowerCase()

    if (!emailAddress) {
      return NextResponse.json(
        { success: false, error: 'emailAddress is required' },
        { status: 400 }
      )
    }

    const contactService = new ContactService()
    let contact = await contactService.getContactByEmail(user.id, emailAddress)

    if (!contact) {
      const createPayload: any = {
        email: emailAddress,
        first_name: body.first_name || undefined,
        last_name: body.last_name || undefined,
        tags: body.tags || ['mailbox'],
      }

      contact = await contactService.createContact(user.id, createPayload)
    }

    // Update referenced emails to point to this contact
    const updates: Array<Promise<any>> = []

    if (body.emailId) {
      updates.push(
        supabase
          .from('incoming_emails')
          .update({ contact_id: contact.id })
          .eq('user_id', user.id)
          .eq('id', body.emailId)
      )
    }

    updates.push(
      supabase
        .from('incoming_emails')
        .update({ contact_id: contact.id })
        .eq('user_id', user.id)
        .is('contact_id', null)
        .ilike('from_address', `%${emailAddress}%`)
    )

    updates.push(
      supabase
        .from('outgoing_emails')
        .update({ contact_id: contact.id })
        .eq('user_id', user.id)
        .is('contact_id', null)
        .ilike('to_address', `%${emailAddress}%`)
    )

    await Promise.allSettled(updates)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          contact,
        },
        message: 'Contact linked to mailbox email',
      }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/inbox/create-contact error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create contact'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
