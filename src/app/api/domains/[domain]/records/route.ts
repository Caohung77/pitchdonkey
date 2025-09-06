import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { promises as dns } from 'dns'

export const GET = withAuth(async (request: NextRequest, { user }, { params }: { params: { domain: string } }) => {
  try {
    const domain = decodeURIComponent(params.domain).toLowerCase()
    const supabase = createServerSupabaseClient()

    // Infer providers from the user's email accounts on this domain
    const { data: accounts } = await supabase
      .from('email_accounts')
      .select('provider, smtp_host')
      .eq('user_id', user.id)
      .ilike('email', `%@${domain}`)

    // Derive SPF sources from actual accounts
    const providers = new Set<string>()
    const smtpHosts = new Set<string>()
    for (const acc of accounts || []) {
      if (acc.provider === 'smtp' && acc.smtp_host) smtpHosts.add(acc.smtp_host)
      else if (acc.provider) providers.add(String(acc.provider))
    }

    let spfRecord
    const meta: any = { providers: Array.from(providers), smtpHosts: Array.from(smtpHosts), smtpIps: [] as string[] }
    if (providers.size > 0) {
      spfRecord = SPFGenerator.generateForProviders(domain, Array.from(providers))
    } else if (smtpHosts.size > 0) {
      // Try to build SPF from SMTP host IPs or include if the host itself publishes SPF
      const ipAddresses: string[] = []
      for (const host of smtpHosts) {
        try {
          // If the host publishes an SPF record, prefer include:host
          // (will be captured by generateRecord via includeProviders if we pass as a provider-like token)
          // Fallback to resolving A/AAAA records and using ip4/ip6
          const a = await dns.resolve4(host).catch(() => [])
          const aaaa = await dns.resolve6(host).catch(() => [])
          ipAddresses.push(...(a as string[]), ...(aaaa as string[]))
          meta.smtpIps.push(...(a as string[]), ...(aaaa as string[]))
        } catch {}
      }
      spfRecord = SPFGenerator.generateRecord({ domain, includeProviders: [], ipAddresses, mechanism: 'softfail' })
    } else {
      // Conservative default if we cannot infer anything
      spfRecord = SPFGenerator.generateRecord({ domain, includeProviders: [], ipAddresses: [], mechanism: 'softfail' })
    }

    // Generate DKIM keys/record (selector is generated inside)
    const dkim = DKIMGenerator.generateForDomain(domain)

    // Generate DMARC (monitoring to start)
    const dmarc = DMARCGenerator.generateProgressiveRecords(domain)

    const records = [
      { type: 'SPF' as const, name: domain, value: spfRecord.record.value, status: 'pending' as const },
      { type: 'DKIM' as const, name: dkim.record.name, value: dkim.record.value, status: 'pending' as const },
      { type: 'DMARC' as const, name: `_dmarc.${domain}`, value: dmarc.monitoring.record.value, status: 'pending' as const },
    ]

    return NextResponse.json({ success: true, records, selector: dkim.config.selector, meta })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to generate records' }, { status: 500 })
  }
})
