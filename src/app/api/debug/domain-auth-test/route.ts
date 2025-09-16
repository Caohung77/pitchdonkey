import { NextRequest, NextResponse } from 'next/server'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

export const POST = async (request: NextRequest) => {
  // Bypass auth for testing
  const supabase = (await import('@/lib/supabase')).createServerSupabaseClient()
  const user = { id: 'ea1f9972-6109-44ec-93d5-05522f49760c' } // Your user ID for testing

  try {
    console.log('🔒 Debug Domain Auth Test: Starting comprehensive domain authentication test...')

    // Get the Gmail account
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')

    if (accountsError || !accounts || accounts.length === 0) {
      console.log('❌ No active Gmail accounts found')
      return NextResponse.json({
        error: 'No active Gmail accounts found',
        code: 'NO_GMAIL_ACCOUNT'
      }, { status: 400 })
    }

    const account = accounts[0]
    const domain = extractDomainFromEmail(account.email)

    console.log('🔒 Debug Domain Auth Test: {')
    console.log('  accountId:', account.id)
    console.log('  email:', account.email)
    console.log('  domain:', domain)
    console.log('  provider:', account.provider)
    console.log('  status:', account.status)
    console.log('}')

    const domainAuthService = new DomainAuthService()

    // Step 1: Get or create domain auth record
    console.log('🔍 Step 1: Getting or creating domain auth record...')
    let domainAuth = await domainAuthService.getDomain(user.id, domain)
    if (!domainAuth) {
      console.log('📝 Creating new domain auth record for:', domain)
      domainAuth = await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })
      console.log('✅ Domain auth record created with ID:', domainAuth.id)
    } else {
      console.log('✅ Found existing domain auth record with ID:', domainAuth.id)
    }

    // Step 2: Generate DNS records
    console.log('🔍 Step 2: Generating DNS records...')

    // SPF Record for Gmail
    const spfRecord = SPFGenerator.generateForProviders(domain, ['gmail'])
    console.log('📧 SPF Record:', spfRecord.record)

    // DKIM Record
    const dkimResult = DKIMGenerator.generateForDomain(domain)
    console.log('🔑 DKIM Record:', dkimResult.record.value)
    console.log('🔑 DKIM Selector:', dkimResult.config.selector)

    // DMARC Record
    const dmarcRecord = DMARCGenerator.generateBasicRecord(domain, `reports@${domain}`)
    console.log('🛡️ DMARC Record:', dmarcRecord.record)

    // Step 3: Update domain auth with generated records
    console.log('🔍 Step 3: Updating domain auth with generated records...')
    const updateData = {
      dkim_selector: dkimResult.config.selector,
      dkim_public_key: dkimResult.config.publicKey,
      dkim_private_key: dkimResult.config.privateKey
    }

    const updatedDomainAuth = await domainAuthService.updateDomain(user.id, domain, updateData)
    console.log('✅ Domain auth updated with DKIM keys')

    // Step 4: Perform domain verification
    console.log('🔍 Step 4: Performing domain verification...')
    try {
      const verificationStatus = await domainAuthService.verifyDomain(user.id, domain, dkimResult.config.selector)
      console.log('🔒 Verification Results:')
      console.log('  SPF:', verificationStatus.spf?.success ? '✅ Valid' : '❌ Failed')
      if (verificationStatus.spf && !verificationStatus.spf.success) {
        console.log('  SPF Errors:', verificationStatus.spf.validation.errors)
      }
      console.log('  DKIM:', verificationStatus.dkim?.success ? '✅ Valid' : '❌ Failed')
      if (verificationStatus.dkim && !verificationStatus.dkim.success) {
        console.log('  DKIM Errors:', verificationStatus.dkim.validation.errors)
      }
      console.log('  DMARC:', verificationStatus.dmarc?.success ? '✅ Valid' : '❌ Failed')
      if (verificationStatus.dmarc && !verificationStatus.dmarc.success) {
        console.log('  DMARC Errors:', verificationStatus.dmarc.validation.errors)
      }
      console.log('  Overall Status:', verificationStatus.overallStatus)

      // Step 5: Get dashboard stats
      console.log('🔍 Step 5: Getting dashboard stats...')
      const dashboardStats = await domainAuthService.getDashboardStats(user.id)
      console.log('📊 Dashboard Stats:', dashboardStats.stats)
      console.log('📊 Overall Health:', dashboardStats.overallHealth)

      return NextResponse.json({
        success: true,
        message: 'Domain authentication test completed',
        details: {
          account: {
            id: account.id,
            email: account.email,
            domain: domain
          },
          domainAuth: {
            id: domainAuth.id,
            domain: domainAuth.domain,
            created: domainAuth.created_at
          },
          dnsRecords: {
            spf: spfRecord.record,
            dkim: dkimResult.record.value,
            dmarc: dmarcRecord.record
          },
          verification: verificationStatus,
          dashboardStats: dashboardStats.stats,
          overallHealth: dashboardStats.overallHealth
        }
      })
    } catch (verificationError) {
      console.error('⚠️ Domain verification failed:', verificationError)

      return NextResponse.json({
        success: true,
        message: 'Domain auth setup completed, verification failed (expected for new domains)',
        details: {
          account: {
            id: account.id,
            email: account.email,
            domain: domain
          },
          domainAuth: {
            id: domainAuth.id,
            domain: domainAuth.domain,
            created: domainAuth.created_at
          },
          dnsRecords: {
            spf: spfRecord.record,
            dkim: dkimResult.record.value,
            dmarc: dmarcRecord.record
          },
          verificationError: verificationError.message,
          note: 'Add the DNS records to your domain and try verification again'
        }
      })
    }

  } catch (error) {
    console.error('🚨 Debug Domain Auth test error:', error)

    return NextResponse.json({
      error: 'Domain auth test failed',
      code: 'DOMAIN_AUTH_TEST_FAILED',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}