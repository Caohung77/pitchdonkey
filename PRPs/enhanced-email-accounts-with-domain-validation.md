name: "Enhanced Email Account Management with Domain Validation"
description: |

## Purpose
Implement a comprehensive email account management system for PitchDonkey with multi-provider support, domain authentication validation, and seamless campaign integration.

## Core Principles
1. **Email Campaign Context**: Seamless integration with campaign execution engine
2. **Domain Authentication**: Real-time SPF, DKIM, DMARC verification
3. **Multi-Provider Support**: Gmail OAuth, Outlook OAuth, and SMTP
4. **Security First**: Encrypted token storage and secure authentication flows
5. **Follow CLAUDE.md**: Adhere to all PitchDonkey patterns and conventions

---

## Goal
Build a production-ready email account management system that allows users to add, configure, and manage email accounts for outbound campaigns with integrated domain authentication validation, account health monitoring, and real-time verification status updates.

## Why
- **Business Value**: Enables reliable email delivery with proper authentication setup
- **Campaign Integration**: Provides verified email accounts for campaign execution engine
- **User Experience**: Simplifies email account setup with guided domain validation
- **Deliverability**: Improves email deliverability through proper domain authentication
- **Security**: Ensures secure handling of OAuth tokens and SMTP credentials

## What
A comprehensive email account management system featuring:
- Multi-provider email account addition (Gmail OAuth, Outlook OAuth, SMTP)
- Real-time domain authentication verification (SPF, DKIM, DMARC)
- Account health monitoring and reputation tracking
- Automated warmup integration for new accounts
- Plan-based account limits enforcement
- Seamless campaign execution integration
- Real-time status updates and validation

### Success Criteria
- [ ] Users can add Gmail accounts via OAuth with proper scope handling
- [ ] Users can add Outlook accounts via Microsoft Graph OAuth
- [ ] Users can configure custom SMTP accounts with connection testing
- [ ] Domain authentication records are verified in real-time
- [ ] Account health metrics are tracked and displayed
- [ ] Plan-based account limits are enforced correctly
- [ ] Email accounts integrate with campaign execution engine
- [ ] OAuth token refresh works automatically
- [ ] Domain verification provides actionable setup guidance

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: CLAUDE.md
  why: Project rules and development patterns

- file: lib/email-providers.ts
  why: Current EmailAccountService implementation and patterns

- file: lib/domain-auth.ts
  why: Existing domain authentication service and validation engine

- file: components/email-accounts/AddEmailAccountDialog.tsx
  why: Current email account UI implementation

- file: src/app/api/email-accounts/route.ts
  why: Current API endpoint patterns and structure

- file: lib/campaign-execution.ts
  why: How email accounts are integrated with campaign processing

- file: lib/oauth-providers.ts
  why: OAuth flow implementations and token management

- file: lib/encryption.ts
  why: Token encryption patterns for secure storage

- file: lib/database-schema.sql
  why: Database structure for email_accounts and domain_auth tables

- file: lib/supabase-server.ts
  why: Server-side database operations patterns

- file: lib/auth.ts
  why: Authentication and plan-based permission patterns

- url: https://developers.google.com/gmail/api/auth/web-server
  why: Gmail OAuth implementation guide

- url: https://docs.microsoft.com/en-us/graph/auth-v2-service
  why: Microsoft Graph OAuth for Outlook integration

- url: https://supabase.com/docs/guides/realtime
  why: Real-time updates for verification status
```

### Current Codebase Tree
```bash
# Current email account related files
.
├── lib/
│   ├── email-providers.ts           # EmailAccountService with basic CRUD
│   ├── domain-auth.ts              # Domain authentication service
│   ├── oauth-providers.ts          # OAuth flow implementations
│   ├── encryption.ts               # Token encryption utilities
│   ├── campaign-execution.ts       # Campaign processing with email accounts
│   └── database-schema.sql         # Database structure
├── components/
│   └── email-accounts/
│       └── AddEmailAccountDialog.tsx # Basic account addition UI
├── src/app/api/
│   └── email-accounts/
│       ├── route.ts                # Basic CRUD endpoints
│       └── oauth/
│           ├── gmail/
│           └── outlook/
└── examples/
    ├── api-routes/campaign-api.ts  # API patterns to follow
    └── business-logic/email-campaign-service.ts # Service patterns
```

### Desired Codebase Tree
```bash
# Enhanced email account system
.
├── lib/
│   ├── email-account-service.ts         # Enhanced service with domain validation
│   ├── domain-validation-engine.ts      # Enhanced domain verification
│   ├── oauth-flows/                     # Organized OAuth implementations
│   │   ├── gmail-oauth.ts              # Gmail-specific OAuth handling
│   │   ├── outlook-oauth.ts            # Outlook-specific OAuth handling
│   │   └── oauth-base.ts               # Common OAuth utilities
│   ├── smtp-service.ts                 # SMTP configuration and testing
│   ├── account-health-monitor.ts       # Health tracking and metrics
│   └── validations.ts                  # Enhanced validation schemas
├── components/
│   └── email-accounts/
│       ├── EmailAccountsPage.tsx       # Main accounts management page
│       ├── AddEmailAccountWizard.tsx   # Multi-step account setup
│       ├── DomainVerificationPanel.tsx # Domain auth status display
│       ├── AccountHealthCard.tsx       # Account health metrics
│       ├── SMTPConfigForm.tsx          # SMTP configuration form
│       └── OAuthConnectButton.tsx      # OAuth connection handling
├── src/app/api/
│   └── email-accounts/
│       ├── route.ts                    # Enhanced CRUD with validation
│       ├── [id]/
│       │   ├── verify/route.ts         # Account verification endpoint
│       │   ├── test-connection/route.ts # Connection testing
│       │   └── health/route.ts         # Health metrics endpoint
│       ├── oauth/
│       │   ├── gmail/
│       │   │   ├── route.ts           # Gmail OAuth initiation
│       │   │   └── callback/route.ts  # Gmail OAuth callback
│       │   └── outlook/
│       │       ├── route.ts           # Outlook OAuth initiation
│       │       └── callback/route.ts  # Outlook OAuth callback
│       └── domain-verification/
│           └── [domain]/route.ts       # Domain verification endpoint
└── __tests__/
    ├── lib/
    │   ├── email-account-service.test.ts
    │   ├── domain-validation-engine.test.ts
    │   └── smtp-service.test.ts
    └── api/
        └── email-accounts.test.ts
```

### Known Gotchas & PitchDonkey Patterns
```typescript
// CRITICAL: Use proper Supabase client for context
// Server-side (API routes): createServerSupabaseClient()
// Client-side (React): createClientSupabase()

// CRITICAL: Email account integration with campaigns
// All email accounts must work with CampaignExecutionEngine
// Account selection logic in campaign-execution.ts

// CRITICAL: Domain authentication integration
// Use existing domain_auth table and DomainAuthService
// Follow existing verification patterns and DNS lookup logic

// CRITICAL: OAuth token encryption
// Use existing encryption service for token storage
// Handle token refresh automatically with proper error handling

// CRITICAL: Plan-based permissions
// Check user plan limits before allowing account creation
// Starter: 1, Professional: 3, Agency: 10 accounts

// CRITICAL: Database consistency
// Follow existing email_accounts table structure
// Use UUID primary keys and soft delete patterns
// JSONB fields for flexible configuration storage

// CRITICAL: Real-time updates
// Use Supabase real-time subscriptions for status updates
// Update verification status in real-time during DNS checks

// CRITICAL: SMTP security
// Never log SMTP passwords in production
// Always encrypt SMTP credentials before storage
// Validate SMTP connections before saving configuration

// CRITICAL: Campaign execution integration
// Email accounts must have is_active and is_verified flags
// Campaign execution engine selects accounts based on health score
// Account rotation logic for load balancing
```

## Implementation Blueprint

### Data Models and Schema
```typescript
// Enhanced email account interfaces
export interface EnhancedEmailAccount {
  id: string
  user_id: string
  provider: 'gmail' | 'outlook' | 'smtp'
  email: string
  name: string
  
  // OAuth configuration
  oauth_tokens?: EncryptedOAuthTokens
  oauth_scopes?: string[]
  
  // SMTP configuration
  smtp_config?: EncryptedSMTPConfig
  
  // Account status
  is_active: boolean
  is_verified: boolean
  verified_at?: string
  
  // Domain authentication
  domain: string
  domain_auth_status: {
    spf_verified: boolean
    dkim_verified: boolean
    dmarc_verified: boolean
    last_checked_at: string
    overall_score: number
  }
  
  // Health metrics
  health_metrics: {
    reputation_score: number
    bounce_rate: number
    complaint_rate: number
    delivery_rate: number
    daily_sent_count: number
    monthly_sent_count: number
  }
  
  // Warmup status
  warmup_status: 'not_started' | 'in_progress' | 'completed' | 'paused'
  warmup_progress: {
    current_day: number
    target_day: number
    daily_target: number
    emails_sent_today: number
  }
  
  // Settings
  settings: {
    daily_limit: number
    delay_between_emails: number
    signature?: string
    custom_headers?: Record<string, string>
  }
  
  created_at: string
  updated_at: string
}

// Domain verification result
export interface DomainVerificationResult {
  domain: string
  spf: {
    verified: boolean
    record?: string
    errors: string[]
  }
  dkim: {
    verified: boolean
    record?: string
    errors: string[]
  }
  dmarc: {
    verified: boolean
    record?: string
    errors: string[]
  }
  overall_score: number
  checked_at: string
}

// Validation schemas
export const emailAccountSchema = z.object({
  provider: z.enum(['gmail', 'outlook', 'smtp']),
  email: z.string().email(),
  name: z.string().min(1),
  smtp_config: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    secure: z.boolean(),
    username: z.string(),
    password: z.string()
  }).optional()
})
```

### Task List (in order of execution)
```yaml
Task 1: Enhance Database Schema
MODIFY lib/database-schema.sql:
  - UPDATE email_accounts table with new fields
  - ADD indexes for domain and verification status
  - ADD foreign key to domain_auth table
  - CREATE account_health_metrics table for tracking

Task 2: Enhanced Email Account Service
CREATE lib/email-account-service.ts:
  - EXTEND existing EmailAccountService
  - ADD domain validation integration
  - ADD account health monitoring
  - IMPLEMENT OAuth token refresh logic
  - ADD SMTP connection testing

Task 3: Domain Validation Engine Enhancement
MODIFY lib/domain-validation-engine.ts:
  - ENHANCE existing DomainVerificationEngine
  - ADD real-time verification endpoints
  - IMPLEMENT setup guidance generation
  - ADD verification history tracking

Task 4: OAuth Flow Implementation
CREATE lib/oauth-flows/:
  - IMPLEMENT Gmail OAuth with proper scopes
  - IMPLEMENT Outlook OAuth with Microsoft Graph
  - ADD token refresh and error handling
  - CREATE OAuth callback handlers

Task 5: SMTP Service Implementation
CREATE lib/smtp-service.ts:
  - IMPLEMENT SMTP connection testing
  - ADD provider-specific configurations
  - CREATE connection validation logic
  - IMPLEMENT error reporting and guidance

Task 6: Enhanced API Endpoints
MODIFY src/app/api/email-accounts/:
  - ENHANCE existing CRUD endpoints
  - ADD domain verification endpoints
  - IMPLEMENT OAuth callback handlers
  - ADD account health endpoints
  - CREATE connection testing endpoints

Task 7: Enhanced UI Components
CREATE components/email-accounts/:
  - BUILD comprehensive accounts management page
  - IMPLEMENT multi-step account setup wizard
  - CREATE domain verification status panel
  - ADD account health monitoring dashboard
  - IMPLEMENT real-time status updates

Task 8: Campaign Integration Update
MODIFY lib/campaign-execution.ts:
  - UPDATE account selection logic
  - ADD health-based account rotation
  - IMPLEMENT account verification checks
  - ENHANCE error handling for account issues

Task 9: Comprehensive Testing
CREATE __tests__/:
  - TEST email account service functionality
  - TEST domain validation engine
  - TEST OAuth flows and token management
  - TEST SMTP configuration and connection
  - TEST API endpoints with authentication

Task 10: Real-time Updates Integration
IMPLEMENT real-time features:
  - ADD Supabase subscriptions for account status
  - IMPLEMENT live domain verification updates
  - ADD real-time health metric updates
  - CREATE notification system for account issues
```

### Per-Task Implementation Details
```typescript
// Task 2: Enhanced Email Account Service
export class EnhancedEmailAccountService {
  private supabase = createServerSupabaseClient()
  private domainService = new DomainAuthService()
  
  async createEmailAccount(
    userId: string, 
    config: EmailAccountConfig
  ): Promise<EnhancedEmailAccount> {
    // PATTERN: Validate plan limits first
    const hasPermission = await checkUserPermissions(userId, 'email_accounts', 'create')
    if (!hasPermission) {
      throw new Error('Account limit reached for your plan')
    }
    
    // PATTERN: Extract domain for validation
    const domain = extractDomainFromEmail(config.email)
    
    // PATTERN: Test connection before creation
    if (config.provider === 'smtp') {
      const connectionTest = await this.testSMTPConnection(config.smtp_config!)
      if (!connectionTest.success) {
        throw new Error(`SMTP connection failed: ${connectionTest.error}`)
      }
    }
    
    // PATTERN: Encrypt sensitive data
    const encryptedData = {
      user_id: userId,
      provider: config.provider,
      email: config.email,
      name: config.name || config.email,
      domain,
      is_active: true,
      is_verified: false,
      health_metrics: this.getDefaultHealthMetrics(),
      warmup_status: 'not_started',
      settings: this.getDefaultSettings()
    }
    
    if (config.oauth_tokens) {
      encryptedData.oauth_tokens = encryptOAuthTokens(config.oauth_tokens)
    }
    
    if (config.smtp_config) {
      encryptedData.smtp_config = encryptSMTPConfig(config.smtp_config)
    }
    
    // PATTERN: Create account with transaction
    const account = await this.supabase
      .from('email_accounts')
      .insert(encryptedData)
      .select()
      .single()
    
    if (!account.data) throw new Error('Failed to create email account')
    
    // PATTERN: Initialize domain verification
    await this.domainService.createDomain(userId, { domain })
    
    // PATTERN: Start domain verification process
    await this.verifyDomainAuthentication(account.data.id)
    
    return account.data
  }
  
  async verifyDomainAuthentication(accountId: string): Promise<DomainVerificationResult> {
    // PATTERN: Get account details
    const account = await this.getAccountById(accountId)
    if (!account) throw new Error('Account not found')
    
    // PATTERN: Use existing domain verification engine
    const verification = await this.domainService.verifyDomain(
      account.user_id, 
      account.domain
    )
    
    // PATTERN: Update account verification status
    await this.updateAccountVerificationStatus(accountId, verification)
    
    return verification
  }
  
  private async testSMTPConnection(config: SMTPConfig): Promise<TestResult> {
    // PATTERN: Secure connection testing without logging credentials
    try {
      const transporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password
        }
      })
      
      await transporter.verify()
      return { success: true, message: 'Connection successful' }
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        guidance: this.getSMTPErrorGuidance(error)
      }
    }
  }
}

// Task 4: OAuth Flow Implementation
export class GmailOAuthService {
  async initiateOAuth(userId: string, redirectUri: string): Promise<string> {
    // PATTERN: Create OAuth URL with proper scopes
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      state: userId // For security and user identification
    })}`
    
    return authUrl
  }
  
  async handleCallback(code: string, userId: string): Promise<OAuthTokens> {
    // PATTERN: Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GMAIL_REDIRECT_URI!
      })
    })
    
    if (!tokenResponse.ok) {
      throw new Error('OAuth token exchange failed')
    }
    
    const tokens = await tokenResponse.json()
    
    // PATTERN: Get user email from Google API
    const userInfo = await this.getUserInfo(tokens.access_token)
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      scope: tokens.scope,
      email: userInfo.email
    }
  }
}
```

### Integration Points
```yaml
DATABASE:
  - migration: Enhance email_accounts table with new fields
  - indexes: Add indexes for domain, verification_status, health_score
  - relationships: Link email_accounts to domain_auth table

AUTHENTICATION:
  - permissions: Check plan-based account limits
  - validation: Validate email account ownership
  - encryption: Encrypt all sensitive configuration data

CAMPAIGN_EXECUTION:
  - integration: Update account selection in CampaignExecutionEngine
  - health_checks: Use account health metrics for selection
  - error_handling: Handle account verification failures gracefully

REAL_TIME:
  - subscriptions: Supabase subscriptions for account status updates
  - notifications: Real-time verification status changes
  - health_metrics: Live updates of account health data

DOMAIN_VALIDATION:
  - integration: Use existing DomainAuthService patterns
  - verification: Real-time SPF, DKIM, DMARC validation
  - guidance: Provide DNS setup instructions and examples
```

## Validation Loop

### Level 1: TypeScript & Linting
```bash
# Fix all compilation and style errors first
npm run build                    # TypeScript compilation
npm run lint                     # ESLint checking

# Expected: No errors. If errors exist, fix before proceeding.
```

### Level 2: Unit Testing
```typescript
// __tests__/lib/enhanced-email-account-service.test.ts
describe('EnhancedEmailAccountService', () => {
  test('creates Gmail account via OAuth', async () => {
    const service = new EnhancedEmailAccountService()
    const mockOAuthTokens = {
      access_token: 'test_token',
      refresh_token: 'refresh_token',
      expires_at: Date.now() + 3600000,
      scope: 'gmail.send',
      email: 'test@gmail.com'
    }
    
    const account = await service.createEmailAccount(userId, {
      provider: 'gmail',
      email: 'test@gmail.com',
      name: 'Test Account',
      oauth_tokens: mockOAuthTokens
    })
    
    expect(account.id).toBeDefined()
    expect(account.provider).toBe('gmail')
    expect(account.is_active).toBe(true)
  })
  
  test('validates SMTP connection before creation', async () => {
    const service = new EnhancedEmailAccountService()
    
    await expect(
      service.createEmailAccount(userId, {
        provider: 'smtp',
        email: 'test@example.com',
        smtp_config: {
          host: 'invalid-host',
          port: 587,
          secure: false,
          username: 'test',
          password: 'wrong'
        }
      })
    ).rejects.toThrow('SMTP connection failed')
  })
  
  test('enforces plan-based account limits', async () => {
    mockCheckUserPermissions.mockResolvedValue(false)
    
    await expect(
      service.createEmailAccount(userId, validGmailConfig)
    ).rejects.toThrow('Account limit reached')
  })
  
  test('verifies domain authentication after creation', async () => {
    const service = new EnhancedEmailAccountService()
    const account = await service.createEmailAccount(userId, validConfig)
    
    const verification = await service.verifyDomainAuthentication(account.id)
    
    expect(verification.domain).toBe('example.com')
    expect(verification.overall_score).toBeGreaterThanOrEqual(0)
  })
})

// __tests__/lib/oauth-flows/gmail-oauth.test.ts
describe('GmailOAuthService', () => {
  test('generates valid OAuth URL', () => {
    const service = new GmailOAuthService()
    const url = service.initiateOAuth(userId, redirectUri)
    
    expect(url).toContain('accounts.google.com/o/oauth2')
    expect(url).toContain('gmail.send')
    expect(url).toContain(userId)
  })
  
  test('handles OAuth callback successfully', async () => {
    const service = new GmailOAuthService()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse)
    })
    
    const tokens = await service.handleCallback('auth_code', userId)
    
    expect(tokens.access_token).toBeDefined()
    expect(tokens.email).toBe('test@gmail.com')
  })
})
```

```bash
# Run tests and iterate until passing
npm run test                     # Run all tests  
npm run test:coverage           # Check coverage
npm test -- --testNamePattern="email-account" # Run specific tests

# If failing: Debug, fix code, re-run (never mock to pass)
```

### Level 3: API Integration Testing
```bash
# Start development server
npm run dev

# Test Gmail OAuth initiation
curl -X POST http://localhost:3000/api/email-accounts/oauth/gmail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"redirect_uri": "http://localhost:3000/api/email-accounts/oauth/gmail/callback"}'

# Expected: {"oauth_url": "https://accounts.google.com/..."}

# Test SMTP account creation
curl -X POST http://localhost:3000/api/email-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "provider": "smtp",
    "email": "test@example.com",
    "name": "Test Account",
    "smtp_config": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "username": "test@gmail.com",
      "password": "app_password"
    }
  }'

# Expected: {"data": {"id": "...", "email": "test@example.com"}}

# Test domain verification
curl -X POST http://localhost:3000/api/email-accounts/domain-verification/example.com \
  -H "Authorization: Bearer <token>"

# Expected: {"spf": {...}, "dkim": {...}, "dmarc": {...}}
```

### Level 4: End-to-End Email Account Testing
```bash
# Test complete workflow:
# 1. Add Gmail account via OAuth flow
# 2. Verify domain authentication records
# 3. Check account health metrics
# 4. Test account in campaign creation
# 5. Verify email sending functionality

# Expected: All steps complete successfully
# Account appears in dashboard with verification status
# Domain verification shows actionable guidance
# Account integrates with campaign execution
# OAuth tokens refresh automatically when needed
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No TypeScript errors: `npm run build`
- [ ] No linting errors: `npm run lint`
- [ ] Gmail OAuth flow works end-to-end
- [ ] Outlook OAuth flow works end-to-end
- [ ] SMTP connection testing validates correctly
- [ ] Domain verification shows real-time results
- [ ] Account health metrics are tracked accurately
- [ ] Plan-based limits are enforced properly
- [ ] Email accounts integrate with campaign execution
- [ ] OAuth token refresh works automatically
- [ ] Real-time updates work for verification status
- [ ] UI components handle loading and error states
- [ ] Encrypted data storage works securely
- [ ] Account selection in campaigns uses health metrics

---

## Anti-Patterns to Avoid
- ❌ Don't log OAuth tokens or SMTP passwords in any environment
- ❌ Don't skip SMTP connection testing before account creation
- ❌ Don't ignore domain verification failures
- ❌ Don't hardcode OAuth scopes - use environment configuration
- ❌ Don't bypass plan-based account limits
- ❌ Don't use expired OAuth tokens without refresh
- ❌ Don't skip encryption for sensitive configuration data
- ❌ Don't ignore account health metrics in campaign execution
- ❌ Don't forget to handle OAuth callback errors gracefully
- ❌ Don't mix server and client Supabase patterns

## Confidence Score: 9/10

High confidence due to:
- Extensive existing email account infrastructure
- Well-established domain authentication service
- Clear OAuth implementation patterns
- Comprehensive database schema already in place
- Strong encryption and security patterns
- Existing campaign integration points

Minor uncertainty on OAuth provider-specific edge cases, but documentation provides clear guidance.