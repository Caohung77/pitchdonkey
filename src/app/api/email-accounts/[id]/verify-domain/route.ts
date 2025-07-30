import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { DomainAuthService } from '@/lib/domain-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const accountId = params.id

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the email account
    const { data: emailAccount, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    // Extract domain from email
    const domain = DomainAuthService.getDomainFromEmail(emailAccount.email)
    if (!domain) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Check domain authentication
    const authResult = await DomainAuthService.checkDomainAuthentication(domain)
    
    // Format for database storage
    const domainAuthData = DomainAuthService.formatForDatabase(authResult)
    
    // Calculate health score based on authentication results
    const healthScore = authResult.overall_score

    // Update the email account with domain authentication results
    const { error: updateError } = await supabase
      .from('email_accounts')
      .update({
        domain_auth: domainAuthData,
        health_score: healthScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    if (updateError) {
      console.error('Error updating email account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update domain authentication data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        domain_auth: authResult,
        health_score: healthScore
      }
    })

  } catch (error) {
    console.error('Domain verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const accountId = params.id

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the email account with domain auth data
    const { data: emailAccount, error: accountError } = await supabase
      .from('email_accounts')
      .select('email, domain_auth, health_score, updated_at')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        email: emailAccount.email,
        domain_auth: emailAccount.domain_auth,
        health_score: emailAccount.health_score,
        last_checked: emailAccount.updated_at
      }
    })

  } catch (error) {
    console.error('Get domain auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}