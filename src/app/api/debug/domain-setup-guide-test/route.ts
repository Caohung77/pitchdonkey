import { NextRequest, NextResponse } from 'next/server'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

export const GET = async (request: NextRequest) => {
  // Bypass auth for testing
  const supabase = (await import('@/lib/supabase')).createServerSupabaseClient()
  const user = { id: 'ea1f9972-6109-44ec-93d5-05522f49760c' } // Your user ID for testing

  try {
    // Get the Gmail account
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json({
        error: 'No active Gmail accounts found',
        code: 'NO_GMAIL_ACCOUNT'
      }, { status: 400 })
    }

    const account = accounts[0]
    const domain = extractDomainFromEmail(account.email)

    // Generate DNS records
    const spfRecord = SPFGenerator.generateForProviders(domain, ['gmail'])
    const dkimResult = DKIMGenerator.generateForDomain(domain)
    const dmarcRecord = DMARCGenerator.generateBasicRecord(domain, `reports@${domain}`)

    // Generate concise setup guide
    const setupGuide = {
      domain,
      email: account.email,
      overview: {
        title: `Domain Authentication Setup for ${domain}`,
        description: "Configure SPF, DKIM, and DMARC records to authenticate your Gmail account and improve email deliverability."
      },
      dnsRecords: [
        {
          step: 1,
          name: "SPF Record",
          description: "Authorizes Gmail to send emails on behalf of your domain",
          record: {
            type: "TXT",
            name: "@",
            value: spfRecord.record.value
          },
          instructions: [
            "Add this TXT record to your domain's DNS:",
            `Name: @ (root domain)`,
            `Value: ${spfRecord.record.value}`,
            "This tells email providers that Gmail is authorized to send emails for your domain."
          ]
        },
        {
          step: 2,
          name: "DKIM Record (Google Recommended)",
          description: "Adds cryptographic signatures to your emails",
          recommendedOption: "Google's Built-in DKIM",
          options: [
            {
              title: "Option A: Google's DKIM (RECOMMENDED)",
              instructions: [
                "🔧 Set up in Google Admin Console:",
                "1. Go to admin.google.com",
                "2. Navigate to: Apps > Google Workspace > Gmail > Authenticate email",
                "3. Select your domain and generate new DKIM record",
                "4. Google will provide a DNS record like:",
                "   Name: google._domainkey",
                "   Value: v=DKIM1; k=rsa; p=MIIBIjANBg... (very long)",
                "5. Add this exact record to your DNS",
                "6. Return to Google Admin and click 'Start authentication'"
              ],
              benefits: "✅ Managed by Google, automatic key rotation, better reliability"
            },
            {
              title: "Option B: Custom DKIM (Alternative)",
              record: {
                type: "TXT",
                name: `${dkimResult.config.selector}._domainkey`,
                value: dkimResult.record.value
              },
              instructions: [
                "Add this TXT record to your domain's DNS:",
                `Name: ${dkimResult.config.selector}._domainkey`,
                `Value: ${dkimResult.record.value}`,
                "Note: The value is very long - make sure it's entered as one continuous string.",
                "Some DNS providers may require splitting into multiple quoted strings."
              ]
            }
          ]
        },
        {
          step: 3,
          name: "DMARC Record",
          description: "Defines policy for emails that fail authentication",
          record: {
            type: "TXT",
            name: "_dmarc",
            value: dmarcRecord.record.value
          },
          instructions: [
            "Add this TXT record to your domain's DNS:",
            `Name: _dmarc`,
            `Value: ${dmarcRecord.record.value}`,
            "This starts with 'p=none' for monitoring. Upgrade to 'p=quarantine' later for stronger protection."
          ]
        }
      ],
      verification: {
        automatic: {
          description: "Use the verify button in your email account settings after adding DNS records",
          waitTime: "Wait 2-4 hours for DNS propagation before verification"
        },
        manual: {
          description: "Check DNS records manually",
          commands: [
            `dig TXT ${domain} | grep spf`,
            `dig TXT ${dkimResult.config.selector}._domainkey.${domain}`,
            `dig TXT _dmarc.${domain}`
          ]
        }
      },
      tips: [
        "DNS changes can take up to 48 hours to propagate worldwide",
        "Start with DMARC 'p=none' policy and monitor for 1-2 weeks",
        "You can only have ONE SPF record per domain",
        "Test email deliverability after setup with services like mail-tester.com"
      ]
    }

    return NextResponse.json({
      success: true,
      setupGuide
    })

  } catch (error) {
    console.error('Error generating domain setup guide:', error)
    return NextResponse.json({
      error: 'Failed to generate setup guide',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}