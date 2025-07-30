import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContactService } from '@/lib/contacts'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined
    const emailStatus = searchParams.get('email_status') || undefined
    const format = searchParams.get('format') || 'json'

    const contactService = new ContactService()
    const contacts = await contactService.exportContacts(user.id, {
      search,
      status,
      tags,
      emailStatus,
      limit: 10000 // Large limit for export
    })

    if (format === 'csv') {
      // Generate CSV content
      const csvContent = generateCSV(contacts)
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="contacts.csv"'
        }
      })
    }

    // Return JSON format
    return NextResponse.json({
      success: true,
      data: contacts,
      meta: {
        total: contacts.length,
        exported_at: new Date().toISOString(),
        filters: {
          search,
          status,
          tags,
          emailStatus
        }
      }
    })

  } catch (error) {
    console.error('Export contacts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateCSV(contacts: any[]): string {
  if (contacts.length === 0) {
    return 'No contacts to export'
  }

  // Define CSV headers
  const headers = [
    'Email',
    'First Name',
    'Last Name',
    'Company Name',
    'Job Title',
    'Website',
    'Phone',
    'Industry',
    'Tags',
    'Status',
    'Email Status',
    'Last Contacted',
    'Last Opened',
    'Last Clicked',
    'Last Replied',
    'Emails Sent',
    'Emails Opened',
    'Emails Clicked',
    'Emails Replied',
    'Emails Bounced',
    'Created At',
    'Updated At'
  ]

  // Convert contacts to CSV rows
  const rows = contacts.map(contact => [
    contact.email || '',
    contact.first_name || '',
    contact.last_name || '',
    contact.company_name || '',
    contact.job_title || '',
    contact.website || '',
    contact.phone || '',
    contact.industry || '',
    (contact.tags || []).join('; '),
    contact.status || '',
    contact.email_status || '',
    contact.last_contacted || '',
    contact.last_opened || '',
    contact.last_clicked || '',
    contact.last_replied || '',
    contact.emails_sent || 0,
    contact.emails_opened || 0,
    contact.emails_clicked || 0,
    contact.emails_replied || 0,
    contact.emails_bounced || 0,
    contact.created_at || '',
    contact.updated_at || ''
  ])

  // Combine headers and rows
  const csvRows = [headers, ...rows]

  // Convert to CSV format with proper escaping
  return csvRows
    .map(row => 
      row.map(field => {
        // Convert to string and escape quotes
        const stringField = String(field)
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`
        }
        return stringField
      }).join(',')
    )
    .join('\n')
}

// POST endpoint for custom export with specific contact IDs
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contact_ids, format = 'json', include_custom_fields = false } = body

    if (!contact_ids || !Array.isArray(contact_ids)) {
      return NextResponse.json(
        { error: 'contact_ids array is required' },
        { status: 400 }
      )
    }

    // Get specific contacts by IDs
    const contactService = new ContactService()
    const contacts = []

    for (const contactId of contact_ids) {
      try {
        const contact = await contactService.getContact(contactId, user.id)
        if (contact) {
          contacts.push(contact)
        }
      } catch (error) {
        // Skip contacts that can't be retrieved
        continue
      }
    }

    if (format === 'csv') {
      const csvContent = generateCSV(contacts)
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="selected_contacts.csv"'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: contacts,
      meta: {
        requested: contact_ids.length,
        found: contacts.length,
        exported_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Custom export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}