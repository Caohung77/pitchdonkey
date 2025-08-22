import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'
import { getDomainAuthSummary } from '@/lib/domain-auth-integration'

// GET /api/domains - Get user's domain authentication overview
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('Fetching domain auth overview for user:', user.id)
    
    const summary = await getDomainAuthSummary(user.id)
    
    return NextResponse.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching domain auth overview:', error)
    return NextResponse.json({
      error: 'Failed to fetch domain authentication overview',
      code: 'FETCH_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

// POST /api/domains - Create a new domain auth record
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const body = await request.json()
    const { domain, dns_provider, auto_configure } = body
    
    if (!domain) {
      return NextResponse.json({
        error: 'Domain is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }
    
    const domainAuthService = new DomainAuthService()
    
    const domainAuth = await domainAuthService.createDomain(user.id, {
      domain: domain.toLowerCase(),
      dns_provider: dns_provider || 'manual',
      auto_configure: auto_configure || false
    })
    
    return NextResponse.json({
      success: true,
      data: domainAuth,
      message: 'Domain authentication record created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating domain auth record:', error)
    
    if (error?.message?.includes('already exists')) {
      return NextResponse.json({
        error: 'Domain already exists for this user',
        code: 'DUPLICATE_DOMAIN'
      }, { status: 409 })
    }
    
    return NextResponse.json({
      error: 'Failed to create domain authentication record',
      code: 'CREATE_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})