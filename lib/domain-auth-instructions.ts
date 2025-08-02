import { DNSRecord } from '@/lib/types/domain-auth'

/**
 * Simple instruction system for domain authentication setup
 * Provides clear, concise guidance without complex tutorials
 */

export interface DNSProviderInstructions {
  id: string
  name: string
  steps: string[]
  notes?: string[]
  helpUrl?: string
}

export interface AuthenticationInstructions {
  spf: {
    what: string
    why: string
    how: string
    common_issues: string[]
  }
  dkim: {
    what: string
    why: string
    how: string
    common_issues: string[]
  }
  dmarc: {
    what: string
    why: string
    how: string
    common_issues: string[]
  }
}

/**
 * Get provider-specific DNS setup instructions
 */
export function getDNSProviderInstructions(provider: string): DNSProviderInstructions {
  const providers: Record<string, DNSProviderInstructions> = {
    cloudflare: {
      id: 'cloudflare',
      name: 'Cloudflare',
      steps: [
        'Log in to your Cloudflare dashboard',
        'Select your domain from the list',
        'Go to DNS > Records',
        'Click "Add record"',
        'Select "TXT" as the type',
        'Enter the name and value as shown above',
        'Click "Save"'
      ],
      notes: [
        'Changes typically take 5-10 minutes to propagate',
        'You can verify the record using Cloudflare\'s DNS checker'
      ],
      helpUrl: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/'
    },
    godaddy: {
      id: 'godaddy',
      name: 'GoDaddy',
      steps: [
        'Log in to your GoDaddy account',
        'Go to "My Products" and find your domain',
        'Click "DNS" next to your domain',
        'Scroll down to "Records" section',
        'Click "Add" and select "TXT"',
        'Enter the host name and TXT value',
        'Click "Save"'
      ],
      notes: [
        'DNS changes can take up to 24 hours to propagate',
        'Use "@" for the root domain or leave the host field empty'
      ],
      helpUrl: 'https://www.godaddy.com/help/add-a-txt-record-19232'
    },
    namecheap: {
      id: 'namecheap',
      name: 'Namecheap',
      steps: [
        'Log in to your Namecheap account',
        'Go to Domain List and click "Manage" next to your domain',
        'Go to "Advanced DNS" tab',
        'Click "Add New Record"',
        'Select "TXT Record" from the dropdown',
        'Enter the host and value as specified',
        'Click the checkmark to save'
      ],
      notes: [
        'Changes usually take 30 minutes to 24 hours to propagate',
        'Use "@" for the root domain'
      ],
      helpUrl: 'https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/'
    },
    route53: {
      id: 'route53',
      name: 'AWS Route 53',
      steps: [
        'Log in to AWS Console and go to Route 53',
        'Click on "Hosted zones"',
        'Select your domain',
        'Click "Create record"',
        'Select "TXT" as the record type',
        'Enter the record name and value',
        'Click "Create records"'
      ],
      notes: [
        'Changes typically propagate within 60 seconds',
        'Leave the name field empty for root domain records'
      ],
      helpUrl: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html'
    },
    generic: {
      id: 'generic',
      name: 'Other DNS Providers',
      steps: [
        'Log in to your DNS provider\'s control panel',
        'Find the DNS management or DNS records section',
        'Look for an option to add a new record',
        'Select "TXT" as the record type',
        'Enter the name/host and value as shown above',
        'Save the record'
      ],
      notes: [
        'The exact interface varies by provider',
        'Look for terms like "DNS Records", "Zone File", or "DNS Management"',
        'DNS propagation can take anywhere from minutes to 24 hours'
      ]
    }
  }

  return providers[provider] || providers.generic
}

/**
 * Get educational content about email authentication
 */
export function getAuthenticationInstructions(): AuthenticationInstructions {
  return {
    spf: {
      what: 'SPF (Sender Policy Framework) is a DNS record that lists which mail servers are authorized to send emails from your domain.',
      why: 'SPF helps prevent email spoofing by telling receiving servers which IPs can legitimately send emails from your domain. This improves deliverability and reduces the chance your emails are marked as spam.',
      how: 'Add a TXT record to your domain\'s DNS with the SPF policy. The record starts with "v=spf1" and includes mechanisms like "include:" for email providers or "ip4:" for specific servers.',
      common_issues: [
        'Having multiple SPF records (only one is allowed per domain)',
        'Exceeding the 10 DNS lookup limit',
        'Using "+all" which allows anyone to send emails',
        'Forgetting to include all your email sending services'
      ]
    },
    dkim: {
      what: 'DKIM (DomainKeys Identified Mail) uses cryptographic signatures to verify that emails haven\'t been tampered with and actually came from your domain.',
      why: 'DKIM provides strong authentication by digitally signing your emails. This significantly improves deliverability and helps build sender reputation with email providers.',
      how: 'Generate a public/private key pair, add the public key as a TXT record in DNS, and configure your email server to sign outgoing emails with the private key.',
      common_issues: [
        'Public key too long for DNS (may need to split into multiple strings)',
        'Wrong selector name or missing "_domainkey" subdomain',
        'Private key not properly configured in email server',
        'Key rotation not planned (keys should be rotated periodically)'
      ]
    },
    dmarc: {
      what: 'DMARC (Domain-based Message Authentication) tells receiving servers what to do with emails that fail SPF or DKIM checks.',
      why: 'DMARC provides policy enforcement and reporting. It prevents email spoofing and gives you visibility into who is sending emails using your domain.',
      how: 'Add a TXT record at "_dmarc.yourdomain.com" with your policy. Start with "p=none" for monitoring, then gradually move to "p=quarantine" or "p=reject".',
      common_issues: [
        'Jumping straight to "p=reject" without testing (can block legitimate emails)',
        'Not setting up aggregate reporting to monitor results',
        'Strict alignment causing legitimate emails to fail',
        'Not having SPF and DKIM properly configured first'
      ]
    }
  }
}

/**
 * Get setup instructions for a specific DNS record
 */
export function getRecordSetupInstructions(
  recordType: 'spf' | 'dkim' | 'dmarc',
  domain: string,
  record: DNSRecord,
  provider?: string
): string {
  const authInstructions = getAuthenticationInstructions()
  const providerInstructions = provider ? getDNSProviderInstructions(provider) : null
  const recordInfo = authInstructions[recordType]

  let instructions = `## ${recordType.toUpperCase()} Setup for ${domain}\n\n`
  
  // What and why
  instructions += `**What it does:** ${recordInfo.what}\n\n`
  instructions += `**Why it matters:** ${recordInfo.why}\n\n`
  
  // DNS record details
  instructions += `**DNS Record to Add:**\n`
  instructions += `- Type: ${record.type}\n`
  instructions += `- Name/Host: ${record.name === domain ? '@' : record.name}\n`
  instructions += `- Value: ${record.value}\n`
  instructions += `- TTL: ${record.ttl || 3600} (1 hour)\n\n`
  
  // Provider-specific steps
  if (providerInstructions) {
    instructions += `**Steps for ${providerInstructions.name}:**\n`
    providerInstructions.steps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}\n`
    })
    instructions += '\n'
    
    if (providerInstructions.notes && providerInstructions.notes.length > 0) {
      instructions += `**Important Notes:**\n`
      providerInstructions.notes.forEach(note => {
        instructions += `- ${note}\n`
      })
      instructions += '\n'
    }
  } else {
    instructions += `**General Steps:**\n`
    const genericSteps = getDNSProviderInstructions('generic').steps
    genericSteps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}\n`
    })
    instructions += '\n'
  }
  
  // Common issues
  instructions += `**Common Issues to Avoid:**\n`
  recordInfo.common_issues.forEach(issue => {
    instructions += `- ${issue}\n`
  })
  instructions += '\n'
  
  // Verification
  instructions += `**Verification:**\n`
  instructions += `After adding the record, you can verify it's working by:\n`
  instructions += `- Using online DNS lookup tools\n`
  instructions += `- Waiting 24 hours for full DNS propagation\n`
  instructions += `- Using the "Verify Now" button in this interface\n`
  
  return instructions
}

/**
 * Get progressive DMARC implementation guide
 */
export function getDMARCProgressiveGuide(domain: string): string {
  return `## DMARC Progressive Implementation for ${domain}

DMARC should be implemented gradually to avoid blocking legitimate emails:

### Phase 1: Monitoring (Start Here)
**Policy:** \`p=none\`
**Duration:** 2-4 weeks
**Purpose:** Collect reports to understand your email ecosystem

Add this record:
\`\`\`
_dmarc.${domain} TXT "v=DMARC1; p=none; rua=mailto:reports@${domain}"
\`\`\`

**What to do:**
- Monitor aggregate reports sent to reports@${domain}
- Identify all legitimate email sources
- Ensure SPF and DKIM are properly configured
- Look for any authentication failures from legitimate sources

### Phase 2: Partial Enforcement
**Policy:** \`p=quarantine; pct=25\`
**Duration:** 2-3 weeks
**Purpose:** Test enforcement on a small percentage

Update to:
\`\`\`
_dmarc.${domain} TXT "v=DMARC1; p=quarantine; pct=25; rua=mailto:reports@${domain}"
\`\`\`

**What to do:**
- Monitor for any legitimate emails being quarantined
- Check spam folders for false positives
- Gradually increase percentage if no issues: 25% → 50% → 75% → 100%

### Phase 3: Full Quarantine
**Policy:** \`p=quarantine; pct=100\`
**Duration:** 2-4 weeks
**Purpose:** Quarantine all failing emails

Update to:
\`\`\`
_dmarc.${domain} TXT "v=DMARC1; p=quarantine; rua=mailto:reports@${domain}"
\`\`\`

**What to do:**
- Continue monitoring reports
- Ensure no legitimate emails are being quarantined
- Address any remaining authentication issues

### Phase 4: Full Protection (Final Goal)
**Policy:** \`p=reject\`
**Purpose:** Reject all failing emails for maximum protection

Final record:
\`\`\`
_dmarc.${domain} TXT "v=DMARC1; p=reject; rua=mailto:reports@${domain}"
\`\`\`

**Important:** Only implement reject policy after confirming all legitimate emails pass authentication!

### Key Points:
- Never skip phases - gradual implementation prevents email delivery issues
- Always monitor reports at each phase
- Have SPF and DKIM working before implementing DMARC
- Consider adding forensic reports (ruf) for detailed failure analysis
- Keep aggregate reporting (rua) enabled to monitor ongoing performance`
}

/**
 * Get troubleshooting guide for common issues
 */
export function getTroubleshootingGuide(): Record<string, string[]> {
  return {
    'DNS Record Not Found': [
      'Wait up to 24 hours for DNS propagation',
      'Check if you used the correct record name (@ for root domain)',
      'Verify the record was saved correctly in your DNS provider',
      'Try using a different DNS checker tool',
      'Contact your DNS provider if the record still doesn\'t appear'
    ],
    'SPF Record Invalid': [
      'Ensure you only have one SPF record per domain',
      'Check that the record starts with "v=spf1"',
      'Verify all include mechanisms point to valid domains',
      'Make sure you haven\'t exceeded the 10 DNS lookup limit',
      'End the record with "~all" or "-all", not "+all"'
    ],
    'DKIM Signature Failed': [
      'Verify the public key is correctly added to DNS',
      'Check that the selector matches between DNS and email server',
      'Ensure the private key is properly configured in your email server',
      'Verify the DKIM record name includes "_domainkey"',
      'Test with a DKIM validator tool'
    ],
    'DMARC Policy Too Strict': [
      'Start with "p=none" for monitoring only',
      'Ensure SPF and DKIM are working before enforcing DMARC',
      'Use relaxed alignment (default) instead of strict',
      'Gradually increase enforcement percentage',
      'Monitor aggregate reports for legitimate failures'
    ],
    'Emails Going to Spam': [
      'Verify all three records (SPF, DKIM, DMARC) are properly configured',
      'Check your sender reputation with email providers',
      'Ensure your email content isn\'t triggering spam filters',
      'Warm up new email accounts gradually',
      'Monitor bounce and complaint rates'
    ]
  }
}