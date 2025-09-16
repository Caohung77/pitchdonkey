import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

// GET /api/email-accounts/[id]/domain-setup-guide - Get complete domain authentication setup guide
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get email account to extract domain
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('email, domain, provider')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    const domain = account.domain || extractDomainFromEmail(account.email)
    const domainAuthService = new DomainAuthService()

    // Get or create domain auth record
    let domainAuth = await domainAuthService.getDomain(user.id, domain)
    if (!domainAuth) {
      domainAuth = await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })
    }

    // Generate DNS records
    const spfRecord = SPFGenerator.generateForProviders(domain, ['gmail'])
    const dkimResult = DKIMGenerator.generateForDomain(domain)
    const dmarcRecord = DMARCGenerator.generateBasicRecord(domain, `reports@${domain}`)

    // Generate setup instructions
    const setupGuide = {
      domain,
      email: account.email,
      provider: account.provider,
      overview: {
        title: "Domain Authentication Setup for Gmail",
        description: "Set up SPF, DKIM, and DMARC records to improve email deliverability and authenticate your domain for sending emails.",
        benefits: [
          "Improved email deliverability and inbox placement",
          "Reduced likelihood of emails being marked as spam",
          "Protection against email spoofing and phishing",
          "Better reputation with email providers",
          "Required for professional email sending"
        ]
      },
      steps: [
        {
          step: 1,
          title: "Set up SPF Record",
          description: "SPF (Sender Policy Framework) authorizes Gmail to send emails on behalf of your domain",
          record: {
            type: "TXT",
            name: "@", // Root domain
            value: spfRecord.record.value,
            ttl: "3600"
          },
          instructions: [
            "Log into your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)",
            `Navigate to DNS management for ${domain}`,
            "Look for existing TXT records with 'v=spf1' - you can only have ONE SPF record",
            "If you have an existing SPF record, modify it to include 'include:_spf.google.com'",
            "If no SPF record exists, create a new TXT record:",
            "- Name/Host: @ (or leave blank for root domain)",
            "- Type: TXT",
            `- Value: ${spfRecord.record.value}`,
            "- TTL: 3600 (1 hour)"
          ],
          validation: {
            method: "DNS lookup",
            command: `dig TXT ${domain}`,
            expected: spfRecord.record.value
          }
        },
        {
          step: 2,
          title: "Set up DKIM Record",
          description: "DKIM (DomainKeys Identified Mail) adds a cryptographic signature to your emails",
          recommendedApproach: "Google's Built-in DKIM (Recommended for Gmail accounts)",
          options: [
            {
              option: "A",
              title: "Google's Built-in DKIM (RECOMMENDED)",
              description: "Use Google Workspace's built-in DKIM authentication - easier and more reliable",
              instructions: [
                "🔧 Set up in Google Admin Console:",
                "1. Go to Google Admin Console (admin.google.com)",
                "2. Navigate to: Apps > Google Workspace > Gmail > Authenticate email",
                "3. Select your domain and click 'Generate new record'",
                "4. Google will provide a DNS record like:",
                "   - Name: google._domainkey",
                "   - Value: v=DKIM1; k=rsa; p=MIIBIjANBg... (very long key)",
                "",
                "📝 Add to your DNS:",
                "5. In your DNS provider, create a TXT record:",
                "   - Name/Host: google._domainkey",
                "   - Type: TXT",
                "   - Value: (paste the full value from Google)",
                "   - TTL: 3600 (1 hour)",
                "",
                "✅ Activate authentication:",
                "6. Return to Google Admin and click 'Start authentication'",
                "7. Google will verify the DNS record and activate DKIM"
              ],
              benefits: [
                "✅ Managed by Google - no private key management needed",
                "✅ Automatic key rotation by Google",
                "✅ Better integration with Gmail/Google Workspace",
                "✅ Official Google support and reliability",
                "✅ Easier setup and maintenance"
              ],
              validation: {
                method: "DNS lookup",
                command: `dig TXT google._domainkey.${domain}`,
                expected: "v=DKIM1; k=rsa; p=..."
              }
            },
            {
              option: "B",
              title: "Custom DKIM (Alternative)",
              description: "Use our generated DKIM keys - more control but requires key management",
              record: {
                type: "TXT",
                name: `${dkimResult.config.selector}._domainkey`,
                value: dkimResult.record.value,
                ttl: "3600"
              },
              instructions: [
                "Create a new TXT record in your DNS settings:",
                `- Name/Host: ${dkimResult.config.selector}._domainkey`,
                "- Type: TXT",
                `- Value: ${dkimResult.record.value}`,
                "- TTL: 3600 (1 hour)",
                "",
                "Important notes:",
                "- The DKIM record value is very long - make sure it's entered as one continuous string",
                "- Some DNS providers require splitting long records into multiple quoted strings",
                "- Keep the private key secure - it's used to sign your emails",
                "- You'll need to manage key rotation manually"
              ],
              validation: {
                method: "DNS lookup",
                command: `dig TXT ${dkimResult.config.selector}._domainkey.${domain}`,
                expected: dkimResult.record.value
              }
            }
          ]
        },
        {
          step: 3,
          title: "Set up DMARC Record",
          description: "DMARC (Domain-based Message Authentication) tells receivers what to do with emails that fail SPF/DKIM checks",
          record: {
            type: "TXT",
            name: "_dmarc",
            value: dmarcRecord.record.value,
            ttl: "3600"
          },
          instructions: [
            "Create a new TXT record in your DNS settings:",
            "- Name/Host: _dmarc",
            "- Type: TXT",
            `- Value: ${dmarcRecord.record.value}`,
            "- TTL: 3600 (1 hour)",
            "",
            "DMARC Policy Explanation:",
            "- p=none: Monitor mode - collect reports but don't block emails",
            "- Start with p=none for 1-2 weeks to monitor your email flow",
            "- Once confident, upgrade to p=quarantine or p=reject for stronger protection"
          ],
          validation: {
            method: "DNS lookup",
            command: `dig TXT _dmarc.${domain}`,
            expected: dmarcRecord.record.value
          }
        }
      ],
      verification: {
        title: "Verify Your Setup",
        description: "After adding all DNS records, use these methods to verify they're working correctly",
        methods: [
          {
            name: "Automatic Verification",
            description: "Use our built-in verification tool",
            action: {
              method: "POST",
              endpoint: `/api/email-accounts/${id}/verify-domain`,
              description: "Click 'Verify Domain' in your email account settings"
            }
          },
          {
            name: "Manual DNS Verification",
            description: "Check DNS records manually using command line tools",
            commands: [
              {
                purpose: "Check SPF record",
                command: `dig TXT ${domain} | grep spf`
              },
              {
                purpose: "Check DKIM record",
                command: `dig TXT ${dkimResult.config.selector}._domainkey.${domain}`
              },
              {
                purpose: "Check DMARC record",
                command: `dig TXT _dmarc.${domain}`
              }
            ]
          },
          {
            name: "Online Tools",
            description: "Use online verification tools for comprehensive testing",
            tools: [
              {
                name: "MXToolbox",
                url: "https://mxtoolbox.com/spf.aspx",
                purpose: "SPF and DMARC verification"
              },
              {
                name: "DKIM Validator",
                url: "https://dkimvalidator.com/",
                purpose: "DKIM record validation"
              },
              {
                name: "Mail Tester",
                url: "https://www.mail-tester.com/",
                purpose: "Complete email authentication test"
              }
            ]
          }
        ]
      },
      troubleshooting: {
        title: "Common Issues & Solutions",
        issues: [
          {
            problem: "SPF record not found or invalid",
            solutions: [
              "Ensure you only have ONE SPF record per domain",
              "Check that the record name is set to '@' or root domain",
              "Verify the syntax starts with 'v=spf1'",
              "Wait up to 48 hours for DNS propagation"
            ]
          },
          {
            problem: "Google DKIM authentication not working",
            solutions: [
              "Verify the DNS record is exactly as provided by Google Admin Console",
              "Check that the record name is 'google._domainkey' (not 'google._domainkey.yourdomain.com')",
              "Ensure you clicked 'Start authentication' in Google Admin after adding DNS record",
              "Wait 2-4 hours for Google to verify the DNS record",
              "Test with: dig TXT google._domainkey.yourdomain.com"
            ]
          },
          {
            problem: "DKIM record too long or truncated",
            solutions: [
              "For Google DKIM: Copy the exact value from Google Admin Console",
              "For custom DKIM: Split the value into multiple quoted strings if required by your DNS provider",
              "Example: \"v=DKIM1; k=rsa; p=MIIBIjAN...\" \"BgkqhkiG9w0BAQ...\" \"EFAAOCAQ8AMI...\"",
              "Ensure no spaces are added between the strings",
              "Some DNS providers have character limits - check with your provider"
            ]
          },
          {
            problem: "DNS changes not propagating",
            solutions: [
              "DNS changes can take up to 48 hours to propagate worldwide",
              "Use online DNS propagation checkers to monitor progress",
              "Clear your local DNS cache if testing locally",
              "Try checking from different networks or locations"
            ]
          },
          {
            problem: "Emails still going to spam after setup",
            solutions: [
              "Wait 24-48 hours for email providers to recognize your authentication",
              "Send a few test emails to build reputation gradually",
              "Ensure your email content isn't triggering spam filters",
              "Monitor DMARC reports for any authentication failures"
            ]
          }
        ]
      },
      dnsRecords: {
        spf: spfRecord.record,
        dkim: {
          type: "TXT",
          name: `${dkimResult.config.selector}._domainkey.${domain}`,
          value: dkimResult.record.value,
          ttl: 3600
        },
        dmarc: dmarcRecord.record
      },
      nextSteps: [
        "Add all three DNS records to your domain",
        "Wait 2-4 hours for DNS propagation",
        "Use the verification tool to confirm setup",
        "Send test emails to check deliverability",
        "Monitor DMARC reports for the first week",
        "Consider upgrading DMARC policy after monitoring period"
      ]
    }

    return NextResponse.json({
      success: true,
      setupGuide
    })

  } catch (error) {
    console.error('Error generating domain setup guide:', error)
    return NextResponse.json({
      error: 'Failed to generate setup guide'
    }, { status: 500 })
  }
}