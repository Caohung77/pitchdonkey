// Domain Authentication TypeScript Types and Interfaces

export interface DomainAuth {
  id: string
  user_id: string
  domain: string
  
  // SPF configuration and status
  spf_verified: boolean
  spf_record?: string
  spf_last_checked?: string
  spf_error_message?: string
  
  // DKIM configuration and status
  dkim_verified: boolean
  dkim_selector: string
  dkim_public_key?: string
  dkim_private_key?: string // Encrypted in database
  dkim_last_checked?: string
  dkim_error_message?: string
  
  // DMARC configuration and status
  dmarc_verified: boolean
  dmarc_record?: string
  dmarc_policy: 'none' | 'quarantine' | 'reject'
  dmarc_percentage: number
  dmarc_report_email?: string
  dmarc_last_checked?: string
  dmarc_error_message?: string
  
  // Provider and automation settings
  dns_provider?: string
  auto_configured: boolean
  
  // Metadata
  created_at: string
  updated_at: string
}

export interface DomainAuthOverview extends DomainAuth {
  fully_verified: boolean
  email_account_count: number
  last_verification_check?: string
  health_status: 'excellent' | 'good' | 'basic' | 'poor'
}

export interface DNSProviderCredentials {
  id: string
  user_id: string
  provider: string
  provider_name?: string
  credentials: Record<string, any> // Encrypted JSON
  is_active: boolean
  last_used?: string
  created_at: string
  updated_at: string
}

export interface DomainVerificationHistory {
  id: string
  domain_auth_id: string
  verification_type: 'spf' | 'dkim' | 'dmarc'
  status: boolean
  error_message?: string
  dns_response?: string
  response_time_ms?: number
  checked_at: string
}

// DNS Record Types
export interface SPFRecord {
  version: string // 'spf1'
  mechanisms: string[] // ['include:_spf.google.com', 'ip4:192.168.1.1']
  qualifier: 'pass' | 'fail' | 'softfail' | 'neutral' // ~all, -all, ?all, +all
  raw: string // Full record text
}

export interface DKIMRecord {
  version: string // 'DKIM1'
  keyType: string // 'rsa'
  publicKey: string // Base64 encoded public key
  selector: string // DKIM selector
  raw: string // Full record text
}

export interface DMARCRecord {
  version: string // 'DMARC1'
  policy: 'none' | 'quarantine' | 'reject'
  percentage?: number
  reportURI?: string[] // Aggregate report emails
  forensicURI?: string[] // Forensic report emails
  alignment?: {
    spf?: 'strict' | 'relaxed'
    dkim?: 'strict' | 'relaxed'
  }
  raw: string // Full record text
}

// Configuration Types
export interface SPFConfig {
  domain: string
  includeProviders: string[] // ['_spf.google.com', 'spf.protection.outlook.com']
  ipAddresses: string[] // ['192.168.1.1', '10.0.0.1']
  mechanism: 'softfail' | 'hardfail' // ~all or -all
}

export interface DKIMConfig {
  domain: string
  selector: string
  keySize: 1024 | 2048
  publicKey: string
  privateKey: string
}

export interface DMARCConfig {
  domain: string
  policy: 'none' | 'quarantine' | 'reject'
  percentage: number
  reportEmail?: string
  aggregateReports: boolean
  forensicReports: boolean
  spfAlignment?: 'strict' | 'relaxed'
  dkimAlignment?: 'strict' | 'relaxed'
}

// Validation and Verification Types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  score?: number // 0-100 quality score
}

export interface VerificationResult {
  type: 'spf' | 'dkim' | 'dmarc'
  success: boolean
  record?: SPFRecord | DKIMRecord | DMARCRecord
  validation: ValidationResult
  responseTime: number
  checkedAt: string
}

export interface DomainVerificationStatus {
  domain: string
  spf: VerificationResult | null
  dkim: VerificationResult | null
  dmarc: VerificationResult | null
  overallStatus: 'verified' | 'partial' | 'unverified' | 'error'
  lastChecked: string
}

// DNS Provider Types
export type DNSProvider = 
  | 'cloudflare'
  | 'godaddy'
  | 'namecheap'
  | 'route53'
  | 'google-domains'
  | 'manual'
  | 'other'

export interface DNSProviderInfo {
  id: DNSProvider
  name: string
  supportsAPI: boolean
  requiresCredentials: boolean
  credentialFields: {
    name: string
    type: 'text' | 'password' | 'email'
    label: string
    placeholder?: string
    required: boolean
  }[]
  helpUrl?: string
  logoUrl?: string
}

export interface DNSRecord {
  type: 'TXT' | 'CNAME' | 'MX' | 'A'
  name: string
  value: string
  ttl?: number
  priority?: number
}

// Tutorial and Educational Types
export interface TutorialStep {
  id: string
  title: string
  description: string
  screenshot?: string
  code?: string
  tips: string[]
  commonMistakes: string[]
  estimatedTime?: number
}

export interface Tutorial {
  id: string
  domain: string
  provider: DNSProvider
  title: string
  description: string
  steps: TutorialStep[]
  totalEstimatedTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  prerequisites: string[]
}

export interface EducationalContent {
  id: string
  type: 'spf' | 'dkim' | 'dmarc' | 'general'
  title: string
  summary: string
  content: string
  importance: 'high' | 'medium' | 'low'
  readingTime: number
  relatedLinks: {
    title: string
    url: string
  }[]
}

// API Request/Response Types
export interface CreateDomainAuthRequest {
  domain: string
  dns_provider?: DNSProvider
  auto_configure?: boolean
}

export interface UpdateDomainAuthRequest {
  spf_record?: string
  dkim_selector?: string
  dmarc_policy?: 'none' | 'quarantine' | 'reject'
  dmarc_percentage?: number
  dmarc_report_email?: string
  dns_provider?: DNSProvider
}

export interface GenerateDNSRecordsRequest {
  domain: string
  spf_config?: Partial<SPFConfig>
  dkim_config?: Partial<DKIMConfig>
  dmarc_config?: Partial<DMARCConfig>
}

export interface GeneratedDNSRecords {
  domain: string
  spf: {
    record: DNSRecord
    config: SPFConfig
  }
  dkim: {
    record: DNSRecord
    config: DKIMConfig
    selector: string
  }
  dmarc: {
    record: DNSRecord
    config: DMARCConfig
  }
  generatedAt: string
}

export interface VerifyDomainRequest {
  domain: string
  types?: ('spf' | 'dkim' | 'dmarc')[]
}

export interface VerifyDomainResponse {
  domain: string
  results: VerificationResult[]
  overallStatus: 'verified' | 'partial' | 'unverified' | 'error'
  nextSteps?: string[]
}

// Dashboard and UI Types
export interface DomainAuthDashboard {
  domains: DomainAuthOverview[]
  overallHealth: 'excellent' | 'good' | 'needs-attention' | 'critical'
  stats: {
    totalDomains: number
    fullyVerified: number
    partiallyVerified: number
    unverified: number
  }
  pendingActions: ActionItem[]
  recentActivity: DomainVerificationHistory[]
}

export interface ActionItem {
  id: string
  type: 'setup' | 'verify' | 'fix' | 'update'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  domain: string
  actionUrl?: string
  estimatedTime?: number
}

// Error Types
export class DomainAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public domain?: string,
    public type?: 'spf' | 'dkim' | 'dmarc'
  ) {
    super(message)
    this.name = 'DomainAuthError'
  }
}

export class DNSLookupError extends DomainAuthError {
  constructor(message: string, domain: string, type: 'spf' | 'dkim' | 'dmarc') {
    super(message, 'DNS_LOOKUP_ERROR', domain, type)
    this.name = 'DNSLookupError'
  }
}

export class ValidationError extends DomainAuthError {
  constructor(message: string, domain: string, type: 'spf' | 'dkim' | 'dmarc') {
    super(message, 'VALIDATION_ERROR', domain, type)
    this.name = 'ValidationError'
  }
}

// Utility Types
export type DomainAuthStatus = 'pending' | 'verified' | 'failed' | 'partial'
export type VerificationType = 'spf' | 'dkim' | 'dmarc'
export type HealthStatus = 'excellent' | 'good' | 'basic' | 'poor'