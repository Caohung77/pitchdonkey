import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'

const updateEmailAccountSchema = z.object({
  status: z.enum(['pending', 'active', 'inactive', 'suspended']).optional(),
  daily_send_limit: z.number().min(1).max(1000).optional(),
  warmup_enabled: z.boolean().optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.number().optional(),
  smtp_username: z.string().optional(),
  smtp_password: z.string().optional(),
  smtp_secure: z.boolean().optional(),
})

// GET /api/email-accounts/[id] - Get specific email account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    console.error('Error fetching email account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/email-accounts/[id] - Update email account
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify account ownership
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existingAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateEmailAccountSchema.parse(body)

    // Update the account with validated data
    const { data: account, error } = await supabase
      .from('email_accounts')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating email account:', error)
      return NextResponse.json({ error: 'Failed to update email account' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Email account updated successfully',
    })
  } catch (error) {
    console.error('Error updating email account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/email-accounts/[id] - Delete email account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify account ownership
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existingAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Delete the account
    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting email account:', error)
      return NextResponse.json({ error: 'Failed to delete email account' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email account deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting email account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}