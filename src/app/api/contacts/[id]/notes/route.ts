import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'

// Schema for validating notes update
const notesUpdateSchema = z.object({
  notes: z.string().max(50000, 'Notes cannot exceed 50,000 characters') // Reasonable limit for rich text
})

// GET /api/contacts/[id]/notes - Get contact notes
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    const contactId = params?.id
    
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    
    // Fetch contact notes - ensure it belongs to the user
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, notes, notes_updated_at')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()
    
    if (error) {
      console.error('Error fetching contact notes:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      data: {
        notes: contact.notes || '',
        notes_updated_at: contact.notes_updated_at
      }
    })

  } catch (error: any) {
    console.error('Contact notes fetch error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to fetch contact notes' 
    }, { status: 500 })
  }
}

// PUT /api/contacts/[id]/notes - Update contact notes
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    const contactId = params?.id
    
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = notesUpdateSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid notes data', 
        details: validationResult.error.errors 
      }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    
    // Update contact notes - ensure it belongs to the user
    const { data: updatedContact, error } = await supabase
      .from('contacts')
      .update({ 
        notes: validationResult.data.notes,
        // notes_updated_at will be automatically updated by database trigger
      })
      .eq('id', contactId)
      .eq('user_id', user.id)
      .select('id, notes, notes_updated_at')
      .single()
    
    if (error) {
      console.error('Error updating contact notes:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      data: {
        notes: updatedContact.notes,
        notes_updated_at: updatedContact.notes_updated_at
      },
      message: 'Notes updated successfully'
    })

  } catch (error: any) {
    console.error('Contact notes update error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to update contact notes' 
    }, { status: 500 })
  }
}