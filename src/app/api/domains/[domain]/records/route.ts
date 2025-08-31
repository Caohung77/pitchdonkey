import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

// GET /api/domains/[domain]/records - Generate DNS records for domain
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ domain: string }> }
) => {
  try {
    const resolvedParams = await params
    const domain = decodeURIComponent(resolvedParams.domain)
    const domainAuthService = new DomainAuthService()

    // Get or create domain authentication record
    let domainAuth = await domainAuthService.getDomain(user.id, domain)
    
    if (!domainAuth) {
      domainAuth = await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })
    }

    // Generate simple DNS records for the domain
    const dkimSelector = domainAuth.dkim_selector || 'coldreach2024'

    const records = [
      {
        type: 'SPF',
        name: domain,
        value: 'v=spf1 include:_spf.google.com include:mailgun.org ~all',
        description: 'SPF record to authorize email servers',
        recordType: 'spf',
        status: domainAuth.spf_verified ? 'verified' : 'pending',
        instructions: [
          'Add this TXT record to your DNS settings',
          'Host/Name: @ (or your domain name)',
          'Value: Copy the entire SPF record above',
          'TTL: 3600 (or default)'
        ]
      },
      {
        type: 'DKIM',
        name: `${dkimSelector}._domainkey.${domain}`,
        value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7vKqvK8nKtKjKtKjKtKjKtKjKtKjKtKjKtKjKtKjKtKjKtKjKtKjKtKj...',
        description: 'DKIM public key for email authentication',
        recordType: 'dkim',
        selector: dkimSelector,
        status: domainAuth.dkim_verified ? 'verified' : 'pending',
        instructions: [
          'Add this TXT record to your DNS settings',
          `Host/Name: ${dkimSelector}._domainkey`,
          'Value: Copy the entire DKIM record above',
          'TTL: 3600 (or default)',
          'Note: This is a development placeholder key'
        ]
      },
      {
        type: 'DMARC',
        name: `_dmarc.${domain}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}; ruf=mailto:dmarc-failures@${domain}; sp=none; adkim=r; aspf=r`,
        description: 'DMARC policy for email authentication',
        recordType: 'dmarc',
        status: domainAuth.dmarc_verified ? 'verified' : 'pending',
        instructions: [
          'Add this TXT record to your DNS settings',
          'Host/Name: _dmarc',
          'Value: Copy the entire DMARC record above',
          'TTL: 3600 (or default)',
          'Start with policy "none" for monitoring'
        ]
      }
    ]

    return NextResponse.json({
      success: true,
      domain,
      records,
      developmentMode: true,
      developmentNotice: 'You are in development mode. These records are for demonstration purposes. In production, you would add these to your actual DNS provider.',
      instructions: {
        general: [
          'Add these DNS TXT records to your domain registrar or DNS provider',
          'DNS changes can take up to 48 hours to propagate worldwide',
          'Verify the records after adding them using the verification button'
        ],
        spf: [
          'SPF records specify which servers are allowed to send email for your domain',
          'Only add one SPF record per domain',
          'Test your SPF record before going live'
        ],
        dkim: [
          'DKIM adds a digital signature to your emails',
          'The selector helps identify which key to use for verification',
          'Keep your private key secure and never share it'
        ],
        dmarc: [
          'DMARC builds on SPF and DKIM to provide email authentication',
          'Start with policy "none" to monitor without blocking emails',
          'Gradually move to "quarantine" then "reject" as you gain confidence'
        ]
      }
    })
  } catch (error) {
    console.error('Error generating DNS records:', error)
    return NextResponse.json({
      error: 'Failed to generate DNS records',
      code: 'GENERATION_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})