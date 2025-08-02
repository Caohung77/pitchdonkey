import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'
import { DomainAuthService } from '@/lib/domain-auth'

// GET /api/domains/[domain]/records - Generate DNS records for domain
export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const domain = decodeURIComponent(params.domain)
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

    // Get user's email accounts for this domain to determine email providers
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('provider, smtp_host')
      .eq('user_id', user.id)
      .eq('domain', domain)

    // Generate SPF record
    const providers: string[] = []
    const ipAddresses: string[] = []

    if (emailAccounts) {
      emailAccounts.forEach(account => {
        if (account.provider === 'gmail') {
          providers.push('gmail')
        } else if (account.provider === 'outlook') {
          providers.push('outlook')
        } else if (account.provider === 'smtp' && account.smtp_host) {
          ipAddresses.push(account.smtp_host)
        }
      })
    }

    const { record: spfRecord } = SPFGenerator.generateForProviders(domain, providers)
    
    // If we have SMTP hosts, generate a combined record
    if (ipAddresses.length > 0) {
      const { record: smtpSpfRecord } = SPFGenerator.generateForSMTP(domain, ipAddresses[0], ipAddresses.slice(1))
      // Combine the records (this is a simplified approach)
      const combinedMechanisms = [
        ...providers.map(p => `include:${p === 'gmail' ? '_spf.google.com' : 'spf.protection.outlook.com'}`),
        ...ipAddresses.map(ip => `ip4:${ip}`)
      ]
      spfRecord.value = `v=spf1 ${combinedMechanisms.join(' ')} ~all`
    }

    // Generate or get existing DKIM record
    let dkimRecord
    if (domainAuth.dkim_public_key && domainAuth.dkim_selector) {
      // Use existing DKIM configuration
      dkimRecord = {
        type: 'TXT',
        name: `${domainAuth.dkim_selector}._domainkey.${domain}`,
        value: `v=DKIM1; k=rsa; p=${domainAuth.dkim_public_key}`,
        ttl: 3600
      }
    } else {
      // Generate new DKIM keys
      const { config, record } = DKIMGenerator.generateForDomain(domain)
      dkimRecord = record

      // Store the DKIM configuration in the database
      await domainAuthService.updateDomain(user.id, domain, {
        dkim_selector: config.selector,
        // Note: In production, you should encrypt the private key
        // dkim_private_key: encrypt(config.privateKey)
      })

      // Update the database with the public key (simplified for demo)
      await supabase
        .from('domain_auth')
        .update({
          dkim_public_key: DKIMGenerator.extractPublicKeyFromPEM ? 
            DKIMGenerator.extractPublicKeyFromPEM(config.publicKey) : 
            config.publicKey.replace(/-----BEGIN PUBLIC KEY-----/, '')
                           .replace(/-----END PUBLIC KEY-----/, '')
                           .replace(/\n/g, ''),
          dkim_selector: config.selector
        })
        .eq('user_id', user.id)
        .eq('domain', domain)
    }

    // Generate DMARC record (start with monitoring)
    const reportEmail = `dmarc-reports@${domain}`
    const { record: dmarcRecord } = DMARCGenerator.generateBasicRecord(domain, reportEmail)

    const records = [
      {
        type: 'SPF',
        name: spfRecord.name,
        value: spfRecord.value,
        status: domainAuth.spf_verified ? 'verified' : 'pending'
      },
      {
        type: 'DKIM',
        name: dkimRecord.name,
        value: dkimRecord.value,
        status: domainAuth.dkim_verified ? 'verified' : 'pending'
      },
      {
        type: 'DMARC',
        name: dmarcRecord.name,
        value: dmarcRecord.value,
        status: domainAuth.dmarc_verified ? 'verified' : 'pending'
      }
    ]

    return NextResponse.json({
      success: true,
      records
    })
  } catch (error) {
    console.error('Error generating DNS records:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to extract public key from PEM (if not available in DKIMGenerator)
function extractPublicKeyFromPEM(pemKey: string): string {
  return pemKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim()
}