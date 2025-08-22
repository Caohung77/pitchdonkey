import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { syncEmailAccountDomains } from '@/lib/domain-auth-integration'

// POST /api/domains/sync - Sync existing email accounts with domain auth
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('Syncing email account domains for user:', user.id)
    
    // Sync existing email accounts with domain auth
    await syncEmailAccountDomains(user.id)
    
    console.log('Domain sync completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Email account domains synced successfully'
    })
  } catch (error) {
    console.error('Error syncing email account domains:', error)
    return NextResponse.json({
      error: 'Failed to sync email account domains',
      code: 'SYNC_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})