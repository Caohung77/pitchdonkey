import { NextRequest, NextResponse } from 'next/server'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'

export const POST = async (request: NextRequest) => {
  // Bypass auth for testing
  const supabase = (await import('@/lib/supabase')).createServerSupabaseClient()
  const user = { id: 'ea1f9972-6109-44ec-93d5-05522f49760c' }

  try {
    console.log('🔒 Testing domain auth with Google\'s DKIM selector...')

    // Get the Gmail account
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json({
        error: 'No active Gmail accounts found'
      }, { status: 400 })
    }

    const account = accounts[0]
    const domain = extractDomainFromEmail(account.email)
    const domainAuthService = new DomainAuthService()

    console.log(`🔍 Testing DKIM with Google's selector for domain: ${domain}`)

    // Test with Google's default DKIM selector
    const googleSelector = 'google'

    try {
      const verificationStatus = await domainAuthService.verifyDomain(user.id, domain, googleSelector)

      console.log('🔒 Verification Results with Google DKIM:')
      console.log('  SPF:', verificationStatus.spf?.success ? '✅ Valid' : '❌ Failed')
      console.log('  DKIM (Google selector):', verificationStatus.dkim?.success ? '✅ Valid' : '❌ Failed')
      console.log('  DMARC:', verificationStatus.dmarc?.success ? '✅ Valid' : '❌ Failed')

      if (verificationStatus.dkim && !verificationStatus.dkim.success) {
        console.log('  DKIM Error:', verificationStatus.dkim.validation.errors)
        console.log('  💡 Recommendation: Use Google\'s DKIM from admin panel instead of custom DKIM')
      }

      return NextResponse.json({
        success: true,
        message: 'Domain verification completed with Google DKIM selector',
        domain,
        selector: googleSelector,
        verification: verificationStatus,
        recommendation: {
          dkim: "Use Google's built-in DKIM from Google Workspace Admin",
          steps: [
            "1. In Google Admin, go to Apps > Google Workspace > Gmail > Authenticate email",
            "2. Select your domain (boniforce.ai)",
            "3. Add the DNS record shown in your screenshot:",
            "   Name: google._domainkey",
            "   Value: (the long DKIM key from Google)",
            "4. Click 'Start Authentication' in Google Admin",
            "5. Our system will then detect the Google DKIM automatically"
          ]
        }
      })

    } catch (verificationError) {
      console.error('⚠️ Verification with Google selector failed:', verificationError)

      return NextResponse.json({
        success: true,
        message: 'Google DKIM not yet configured',
        domain,
        selector: googleSelector,
        status: 'Google DKIM not found - needs setup in Google Admin',
        instructions: {
          title: "Set up Google's DKIM Authentication",
          steps: [
            "1. In your Google Admin panel, complete the DKIM setup",
            "2. Add the DNS TXT record Google provides:",
            "   Name: google._domainkey",
            "   Value: v=DKIM1; k=rsa; p=MIIBIjANBg... (from your screenshot)",
            "3. Click 'NEUEN EINTRAG ERSTELLEN' to activate",
            "4. Wait 2-4 hours for DNS propagation",
            "5. Test again with our verification tool"
          ],
          currentDnsRecordsNeeded: [
            {
              name: "@",
              type: "TXT",
              value: "v=spf1 include:_spf.google.com ~all",
              purpose: "SPF - Authorizes Google to send emails for your domain"
            },
            {
              name: "google._domainkey",
              type: "TXT",
              value: "(Google provides this in admin panel)",
              purpose: "DKIM - Google's cryptographic email signature"
            },
            {
              name: "_dmarc",
              type: "TXT",
              value: "v=DMARC1; p=none; rua=mailto:reports@boniforce.ai",
              purpose: "DMARC - Email authentication policy"
            }
          ]
        }
      })
    }

  } catch (error) {
    console.error('🚨 Google DKIM test error:', error)
    return NextResponse.json({
      error: 'Google DKIM test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}