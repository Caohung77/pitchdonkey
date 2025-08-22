# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
```bash
# Development server
npm run dev                    # Start Next.js development server on http://localhost:3000

# Building
npm run build                  # Build for production
npm run start                  # Start production server

# Quality assurance
npm run lint                   # Run ESLint
npm run test                   # Run Jest tests
npm run test:watch             # Run Jest in watch mode
npm run test:coverage          # Run tests with coverage report
```

### Testing Specific Components
```bash
# Test specific files or patterns
npm test -- --testPathPattern=campaigns
npm test -- --testPathPattern=auth
npm test -- lib/email-providers.test.ts

# Test with debugging
npm test -- --watch --verbose
```

## Project Architecture

### Technology Stack
- **Framework**: Next.js 15.4+ with App Router
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **Authentication**: Pure Supabase Auth (no NextAuth.js)
- **UI Components**: Radix UI with Tailwind CSS and custom shadcn/ui components
- **Email Processing**: Multi-provider support (Gmail OAuth, Outlook OAuth, SMTP)
- **AI Integration**: OpenAI and Anthropic for email personalization
- **State Management**: React hooks with Supabase client-side subscriptions

### Application Structure

#### Authentication System (`lib/auth.ts`, `lib/supabase-*.ts`)
- **Hybrid Architecture**: Separate client and server-side Supabase clients
- `lib/supabase-client.ts`: Browser client for React components
- `lib/supabase-server.ts`: Server-side client with service role for API routes
- `lib/supabase.ts`: Unified exports for both environments
- **Plan-based Permissions**: Starter, Professional, Agency tiers with resource limits
- **Usage Tracking**: Real-time monitoring of email accounts, contacts, and campaigns

#### Email Campaign System (`lib/campaigns.ts`, `lib/campaign-execution.ts`)
- **Multi-step Sequences**: Up to 7 email steps with conditional logic
- **AI Personalization**: Template-based and custom prompt personalization
- **A/B Testing**: Subject line, content, and send time variants
- **Scheduling Engine**: Business hours, timezone detection, rate limiting
- **Execution Engine**: Job queue system with retry logic and batch processing
- **Campaign States**: draft → active → paused/completed/stopped

#### Email Provider Integration (`lib/email-providers.ts`, `lib/oauth-providers.ts`)
- **Multi-provider Support**: Gmail (OAuth2), Outlook (OAuth2), Custom SMTP
- **Token Management**: Encrypted OAuth token storage with auto-refresh
- **Domain Authentication**: SPF, DKIM, DMARC validation and setup
- **Warmup System**: Automated email warmup with reputation monitoring
- **Rate Limiting**: Per-account, per-domain, and global rate limits

#### Contact Management (`lib/contacts.ts`, `lib/contact-segmentation.ts`)
- **Contact Lists**: Bulk import, segmentation, and custom fields
- **Email Validation**: Real-time validation with status tracking
- **Engagement Tracking**: Opens, clicks, replies, and unsubscribes
- **Smart Segmentation**: Dynamic segments based on engagement and custom criteria

#### Database Schema (`lib/database-schema.sql`, `lib/database.types.ts`)
**Core Tables:**
- `users`: User profiles with plan limits and usage stats
- `email_accounts`: Multi-provider email account configurations
- `contacts`: Contact database with engagement tracking
- `campaigns`: Campaign definitions with sequence and AI settings
- `email_sends`: Individual email tracking and delivery status
- `ai_templates`: Personalization templates and prompts
- `warmup_progress`: Email warmup tracking and metrics

**Key Relationships:**
- Users → Email Accounts (1:many, plan-limited)
- Campaigns → Contacts (many:many via campaign_contacts)
- Email Accounts → Email Sends (1:many for delivery tracking)
- AI Templates → AI Personalizations (1:many for usage tracking)

## API Architecture

### Route Structure
```
/api/
├── auth/                      # Authentication endpoints
│   ├── signin/               # Sign in with email/password
│   ├── signup/               # User registration
│   ├── callback/             # OAuth callback handler
│   └── session/              # Session management
├── campaigns/                 # Campaign management
│   ├── [id]/                 # Individual campaign operations
│   └── route.ts              # List, create campaigns
├── contacts/                  # Contact management
│   ├── import/               # Bulk contact import
│   ├── segments/             # Dynamic segmentation
│   └── stats/                # Contact analytics
├── email-accounts/           # Email provider integration
│   ├── oauth/                # OAuth flow handlers
│   │   ├── gmail/
│   │   └── outlook/
│   └── [id]/verify/          # Account verification
└── ai/                       # AI personalization
    ├── personalize/          # Single email personalization
    ├── bulk-personalize/     # Batch personalization
    └── templates/            # Template management
```

### Authentication Patterns
All API routes use server-side authentication:
```typescript
// Get authenticated user from server
const user = await requireAuth() // throws if not authenticated

// Check plan-based permissions
const hasPermission = await checkUserPermissions(userId, 'campaigns', 'create')
```

### Error Handling
Standardized error responses across all routes:
```typescript
return NextResponse.json(
  { error: 'Resource not found', code: 'NOT_FOUND' },
  { status: 404 }
)
```

## Development Guidelines

### Component Patterns
- **Server Components**: Default for data fetching and static content
- **Client Components**: Use `"use client"` only for interactivity
- **Supabase Integration**: Use appropriate client (browser vs server) for context
- **Real-time Updates**: Implement subscriptions for live data updates

### Database Conventions
- **UUIDs**: All primary keys use UUID v4
- **Timestamps**: All tables have `created_at` and `updated_at` with automatic triggers
- **Soft Deletes**: Use `deleted_at` fields instead of hard deletes
- **JSONB Fields**: Store flexible data like settings, custom fields, and tracking data
- **Encryption**: Sensitive data (OAuth tokens, SMTP credentials) encrypted at rest

### Testing Strategy
- **Unit Tests**: Focus on utility functions and business logic (`lib/` directory)
- **Integration Tests**: API routes and database operations
- **Component Tests**: Critical UI components with user interactions
- **Mock Data**: Use realistic test data that matches production schemas

### Environment Variables
Required environment variables (check `.env.example` if available):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## Common Patterns

### Supabase Client Usage
```typescript
// Client-side (React components)
import { createClientSupabase } from '@/lib/supabase'
const supabase = createClientSupabase()

// Server-side (API routes)
import { createServerSupabaseClient } from '@/lib/supabase'
const supabase = createServerSupabaseClient()
```

### Campaign Execution Flow
1. **Campaign Creation**: Validate sequence and settings
2. **Contact Selection**: Apply segmentation and filters
3. **Job Scheduling**: Create email jobs based on timing rules
4. **Email Processing**: Apply personalization and send emails
5. **Engagement Tracking**: Monitor opens, clicks, and replies
6. **Sequence Logic**: Progress contacts based on conditions

### Email Provider Integration
1. **OAuth Setup**: Redirect to provider authorization
2. **Token Management**: Store encrypted tokens with refresh logic
3. **Domain Verification**: Validate SPF/DKIM/DMARC records
4. **Warmup Process**: Gradual volume increase with reputation monitoring
5. **Sending**: Route emails through appropriate provider with tracking

### AI Personalization Pipeline
1. **Template Selection**: Choose base template or custom prompt
2. **Context Gathering**: Collect contact and company data
3. **AI Processing**: Generate personalized content via OpenAI/Anthropic
4. **Quality Control**: Validate output and apply fallback if needed
5. **Usage Tracking**: Record tokens used and personalization success

## Troubleshooting

### Common Issues
- **Authentication Loops**: Check middleware.ts - it's configured to pass through all routes to avoid conflicts
- **Database Connection**: Verify Supabase environment variables and network access
- **Email Sending**: Ensure provider credentials are valid and domain authentication is set up
- **Campaign Not Starting**: Check contact list validity and email account status

### Debug Tools
- Use `/debug-auth` page for authentication troubleshooting
- Check browser network tab for API response details
- Monitor Supabase dashboard for real-time database activity
- Use `console.log` in API routes - they appear in terminal, not browser console

### Performance Considerations
- **Pagination**: Implement for large contact lists and campaign history
- **Caching**: Use Supabase real-time subscriptions instead of polling
- **Batch Operations**: Process email sends in configurable batch sizes
- **Index Usage**: Ensure database queries use appropriate indexes for large datasets