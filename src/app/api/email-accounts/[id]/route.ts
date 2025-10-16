import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { z } from 'zod'

const updateEmailAccountSchema = z.object({
  // Note: 'name' field doesn't exist in actual database schema (supabase-setup.sql)
  settings: z.object({
    daily_limit: z.number().min(1).max(1000).optional(),
    delay_between_emails: z.number().min(1).optional(),
    warm_up_enabled: z.boolean().optional(),
    signature: z.string().optional()
  }).optional(),
  smtp_config: z.object({
    host: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    secure: z.boolean().optional()
  }).optional(),
  imap_config: z.object({
    enabled: z.boolean().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    secure: z.boolean().optional()
  }).optional()
})

// GET /api/email-accounts/[id] - Get specific email account
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await withRateLimit(user, 100, 60000) // 100 requests per minute
    
    const { id } = await params
    
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          error: 'Email account not found',
          code: 'NOT_FOUND'
        }, { status: 404 })
      }
      
      console.error('Error fetching email account:', error)
      return NextResponse.json({
        error: 'Failed to fetch email account',
        code: 'FETCH_ERROR'
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      data: account
    })
    
    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error fetching email account:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})

// PUT /api/email-accounts/[id] - Update email account
export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await withRateLimit(user, 20, 60000) // 20 updates per minute
    
    const body = await request.json()
    
    // Validate input
    const validationResult = updateEmailAccountSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    const updateData = validationResult.data

    const { id } = await params
    
    // First, verify the account exists and belongs to the user
    const { data: existingAccount, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingAccount) {
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // Prepare update object based on actual database schema
    const updateObject: any = {
      updated_at: new Date().toISOString()
    }

    // Handle settings updates - map to actual fields that exist
    if (updateData.settings) {
      if (updateData.settings.daily_limit !== undefined) {
        updateObject.daily_send_limit = updateData.settings.daily_limit
      }
      if (updateData.settings.warm_up_enabled !== undefined) {
        updateObject.warmup_enabled = updateData.settings.warm_up_enabled

        // Initialize warmup when enabling it
        if (updateData.settings.warm_up_enabled === true) {
          updateObject.warmup_stage = 'active'
          updateObject.warmup_current_week = 1
          updateObject.warmup_current_daily_limit = 5 // Week 1 starts at 5 emails/day

          // Reset counters
          updateObject.current_daily_sent = 0
        } else if (updateData.settings.warm_up_enabled === false) {
          // When disabling warmup, reset to not_started
          updateObject.warmup_stage = 'not_started'
        }
      }
    }

    // Handle SMTP config updates - map to individual columns
    if (updateData.smtp_config) {
      if (updateData.smtp_config.host !== undefined) {
        updateObject.smtp_host = updateData.smtp_config.host
      }
      if (updateData.smtp_config.port !== undefined) {
        updateObject.smtp_port = updateData.smtp_config.port
      }
      if (updateData.smtp_config.username !== undefined) {
        updateObject.smtp_username = updateData.smtp_config.username
      }
      if (updateData.smtp_config.password !== undefined) {
        updateObject.smtp_password = updateData.smtp_config.password
      }
      if (updateData.smtp_config.secure !== undefined) {
        updateObject.smtp_secure = updateData.smtp_config.secure
      }
    }

    // Handle IMAP config updates - map to individual columns
    if (updateData.imap_config) {
      if (updateData.imap_config.enabled !== undefined) {
        updateObject.imap_enabled = updateData.imap_config.enabled
      }
      if (updateData.imap_config.host !== undefined) {
        updateObject.imap_host = updateData.imap_config.host
      }
      if (updateData.imap_config.port !== undefined) {
        updateObject.imap_port = updateData.imap_config.port
      }
      if (updateData.imap_config.secure !== undefined) {
        updateObject.imap_secure = updateData.imap_config.secure
      }
    }

    // Update the account
    const { data: updatedAccount, error: updateError } = await supabase
      .from('email_accounts')
      .update(updateObject)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating email account:', updateError)
      return NextResponse.json({
        error: 'Failed to update email account',
        code: 'UPDATE_ERROR'
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      data: updatedAccount,
      message: 'Email account updated successfully'
    })
    
    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error updating email account:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})

// DELETE /api/email-accounts/[id] - Delete (soft delete) email account
export const DELETE = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await withRateLimit(user, 10, 60000) // 10 deletes per minute

    const { id } = await params

    console.log('🗑️ DELETE email account request:', {
      accountId: id,
      userId: user.id,
      userEmail: user.email
    })

    // First, verify the account exists and belongs to the user
    const { data: existingAccount, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, user_id, email, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    console.log('📋 Account lookup result:', {
      found: !!existingAccount,
      account: existingAccount,
      error: fetchError
    })

    if (fetchError || !existingAccount) {
      console.log('❌ Account not found or access denied')
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // Check for active campaigns using this email account
    console.log('🔍 Checking for active campaigns...')
    const { data: activeCampaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('from_email_account_id', id)
      .in('status', ['active', 'sending', 'scheduled'])
      .limit(5)

    console.log('📊 Campaign check result:', {
      campaignCount: activeCampaigns?.length || 0,
      campaigns: activeCampaigns,
      error: campaignError
    })

    if (campaignError) {
      console.warn('Could not check for active campaigns:', campaignError)
      // Continue with deletion but log the warning
    }

    if (activeCampaigns && activeCampaigns.length > 0) {
      console.log('🚫 Cannot delete: active campaigns found')
      return NextResponse.json({
        error: `Cannot delete email account. ${activeCampaigns.length} active campaign(s) are using this account. Please pause or stop these campaigns first.`,
        code: 'CAMPAIGNS_ACTIVE',
        details: {
          activeCampaigns: activeCampaigns.map(c => ({ id: c.id, name: c.name }))
        }
      }, { status: 400 })
    }

    // Soft delete by setting deleted_at
    console.log('🗑️ Performing soft delete...')
    const { error: deleteError } = await supabase
      .from('email_accounts')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)

    console.log('📝 Delete operation result:', {
      success: !deleteError,
      error: deleteError
    })

    if (deleteError) {
      console.error('❌ Error deleting email account:', deleteError)
      return NextResponse.json({
        error: 'Failed to delete email account',
        code: 'DELETE_ERROR'
      }, { status: 500 })
    }

    console.log('✅ Email account deleted successfully')
    const response = NextResponse.json({
      success: true,
      message: 'Email account deleted successfully'
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error deleting email account:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})
