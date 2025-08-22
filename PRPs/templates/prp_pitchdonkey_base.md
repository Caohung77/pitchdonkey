name: "PitchDonkey Email Marketing PRP Template"
description: |

## Purpose
Template optimized for implementing email marketing features in PitchDonkey with comprehensive context and validation loops.

## Core Principles
1. **Email Campaign Context**: Include campaign execution patterns and email provider integrations
2. **Supabase Integration**: Proper client vs server-side patterns
3. **Next.js App Router**: Correct API route and component patterns
4. **Validation Loops**: Email sending, campaign execution, and UI testing
5. **Follow CLAUDE.md**: Adhere to all project rules and patterns

---

## Goal
[What email marketing feature needs to be built - be specific about campaign functionality and user impact]

## Why
- **Business Value**: [How this improves email marketing workflows]
- **Campaign Integration**: [How this integrates with existing campaign system]
- **User Impact**: [Problems this solves for email marketers]

## What
[User-visible behavior and technical requirements for the email marketing feature]

### Success Criteria
- [ ] [Specific measurable outcomes for email campaigns]
- [ ] [Integration points working correctly]
- [ ] [Email sending functionality operational]

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: CLAUDE.md
  why: Project rules and development patterns

- file: lib/database-schema.sql
  why: Database structure for campaigns, contacts, email accounts

- file: lib/campaigns.ts
  why: Campaign execution patterns and validation schemas

- file: lib/campaign-execution.ts
  why: Email job processing and sequence logic

- file: lib/email-providers.ts
  why: Multi-provider email integration patterns

- file: lib/auth.ts
  why: Authentication and plan-based permission patterns

- file: lib/supabase-server.ts
  why: Server-side database operations

- file: lib/supabase-client.ts
  why: Client-side real-time subscriptions

- url: https://supabase.com/docs/guides/database
  why: Database operations and real-time subscriptions

- url: https://nextjs.org/docs/app
  why: Next.js App Router patterns for API routes

- url: https://www.radix-ui.com/primitives/docs/overview/introduction
  why: UI component patterns for email marketing interfaces
```

### Current Codebase Tree
```bash
# Run: find . -name "*.ts" -o -name "*.tsx" | grep -E "(lib|components|src)" | head -20
.
├── lib/                          # Core business logic
│   ├── campaigns.ts             # Campaign management and validation
│   ├── campaign-execution.ts    # Email job processing engine
│   ├── email-providers.ts       # Multi-provider email integration
│   ├── contacts.ts              # Contact management and segmentation
│   ├── auth.ts                  # Authentication and permissions
│   ├── supabase-*.ts           # Database client configurations
│   └── database-schema.sql      # Database structure
├── components/                   # UI components
│   ├── campaigns/               # Campaign management UI
│   ├── contacts/                # Contact management UI
│   ├── email-accounts/          # Email provider UI
│   └── ui/                      # Shared UI components
└── src/app/                     # Next.js App Router
    ├── api/                     # API routes
    │   ├── campaigns/           # Campaign API endpoints
    │   ├── contacts/            # Contact API endpoints
    │   └── email-accounts/      # Email provider API endpoints
    └── dashboard/               # Dashboard pages
```

### Desired Codebase Tree
```bash
# New files to be added for this feature
[Show exactly where new files will be added and their responsibilities]
```

### Known Gotchas & PitchDonkey Patterns
```typescript
// CRITICAL: Use proper Supabase client for context
// Server-side (API routes): createServerSupabaseClient()
// Client-side (React): createClientSupabase()

// CRITICAL: Email campaign execution patterns
// All email jobs go through campaign-execution.ts engine
// Use CampaignExecutionEngine for processing emails

// CRITICAL: Authentication patterns
// Check user permissions with checkUserPermissions()
// Use requireAuth() in API routes for authentication

// CRITICAL: Database patterns
// All tables use UUID primary keys
// Use soft deletes with deleted_at field
// JSONB fields for flexible data (settings, custom_fields)

// CRITICAL: Email provider integration
// OAuth tokens are encrypted at rest
// Use EmailAccountService for provider operations
// Support Gmail OAuth, Outlook OAuth, and SMTP

// CRITICAL: Contact management
// Contacts support segmentation and custom fields
// Email validation happens in real-time
// Engagement tracking (opens, clicks, replies)

// CRITICAL: Campaign sequence logic
// Support up to 7 email steps with conditional logic
// AI personalization through OpenAI/Anthropic
// A/B testing for subject lines and content
```

## Implementation Blueprint

### Data Models and Schema
```typescript
// Database schema changes needed
// Add to lib/database-schema.sql if new tables required

// TypeScript interfaces to add to lib/database.types.ts
interface NewFeatureTable {
  Row: {
    id: string
    user_id: string
    // ... other fields
    created_at: string
    updated_at: string
  }
  Insert: {
    // Insert type
  }
  Update: {
    // Update type  
  }
}

// Zod validation schemas to add to lib/validations.ts
export const newFeatureSchema = z.object({
  // validation rules
})
```

### Task List (in order of execution)
```yaml
Task 1: Database Schema Updates
MODIFY lib/database-schema.sql:
  - ADD new tables if needed
  - ADD indexes for performance
  - ADD foreign key relationships

Task 2: TypeScript Type Definitions
MODIFY lib/database.types.ts:
  - ADD new interface definitions
  - FOLLOW existing table patterns
  - ENSURE proper typing

Task 3: Validation Schemas
MODIFY lib/validations.ts:
  - ADD Zod schemas for new data
  - FOLLOW existing validation patterns
  - INCLUDE proper error messages

Task 4: Business Logic Implementation
CREATE lib/[feature-name].ts:
  - FOLLOW patterns from lib/campaigns.ts
  - USE proper Supabase client
  - IMPLEMENT error handling
  - ADD logging for debugging

Task 5: API Route Creation
CREATE src/app/api/[feature-routes]/route.ts:
  - FOLLOW Next.js App Router patterns
  - USE requireAuth() for authentication
  - IMPLEMENT proper error responses
  - ADD request validation

Task 6: UI Components
CREATE components/[feature]/[Component].tsx:
  - USE Radix UI components
  - FOLLOW existing component patterns
  - IMPLEMENT proper loading states
  - ADD error boundaries

Task 7: Dashboard Integration
MODIFY src/app/dashboard/[page]/page.tsx:
  - INTEGRATE new components
  - FOLLOW existing layout patterns
  - ENSURE responsive design

Task 8: Testing Implementation
CREATE __tests__/lib/[feature].test.ts:
  - TEST business logic functions
  - MOCK external dependencies
  - COVER happy path and edge cases
```

### Per-Task Implementation Details
```typescript
// Task 4: Business Logic Example
// lib/advanced-segmentation.ts

import { createServerSupabaseClient } from './supabase'
import { z } from 'zod'

export class AdvancedSegmentationService {
  // PATTERN: Follow existing service patterns
  private supabase = createServerSupabaseClient()
  
  async createSegment(userId: string, segmentData: SegmentInput) {
    // PATTERN: Always validate input first
    const validated = segmentSchema.parse(segmentData)
    
    // PATTERN: Check permissions
    const hasPermission = await checkUserPermissions(userId, 'segments', 'create')
    if (!hasPermission) {
      throw new Error('Insufficient permissions')
    }
    
    // PATTERN: Database operation with error handling
    const { data, error } = await this.supabase
      .from('contact_segments')
      .insert({
        user_id: userId,
        ...validated,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Task 5: API Route Example  
// src/app/api/segments/route.ts

export async function POST(request: Request) {
  try {
    // PATTERN: Authentication first
    const user = await requireAuth()
    
    // PATTERN: Validate request body
    const body = await request.json()
    const validated = segmentSchema.parse(body)
    
    // PATTERN: Use service layer
    const service = new AdvancedSegmentationService()
    const result = await service.createSegment(user.id, validated)
    
    return NextResponse.json({ data: result })
  } catch (error) {
    // PATTERN: Standardized error responses
    return NextResponse.json(
      { error: error.message }, 
      { status: error.status || 500 }
    )
  }
}
```

### Integration Points
```yaml
DATABASE:
  - migration: [Describe any schema changes needed]
  - indexes: [New indexes for performance]

EMAIL_CAMPAIGNS:
  - integration: [How this connects to campaign execution]
  - patterns: [Follow campaign-execution.ts patterns]

AUTHENTICATION:
  - permissions: [What permissions are required]
  - plan_limits: [How this affects subscription limits]

UI_COMPONENTS:
  - dashboard: [Where this appears in dashboard]
  - navigation: [Navigation updates needed]
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
// __tests__/lib/advanced-segmentation.test.ts
describe('AdvancedSegmentationService', () => {
  test('creates segment successfully', async () => {
    const service = new AdvancedSegmentationService()
    const result = await service.createSegment(userId, validSegmentData)
    
    expect(result.id).toBeDefined()
    expect(result.user_id).toBe(userId)
  })
  
  test('validates input data', async () => {
    const service = new AdvancedSegmentationService()
    
    await expect(
      service.createSegment(userId, invalidData)
    ).rejects.toThrow('Validation error')
  })
  
  test('checks user permissions', async () => {
    // Mock insufficient permissions
    mockCheckUserPermissions.mockResolvedValue(false)
    
    await expect(
      service.createSegment(userId, validData)
    ).rejects.toThrow('Insufficient permissions')
  })
})
```

```bash
# Run tests and iterate until passing
npm run test                     # Run all tests  
npm run test:coverage           # Check coverage
npm test -- --testNamePattern="segment" # Run specific tests

# If failing: Debug, fix code, re-run (never mock to pass)
```

### Level 3: API Integration Testing
```bash
# Start development server
npm run dev

# Test API endpoints
curl -X POST http://localhost:3000/api/segments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test Segment", "criteria": {...}}'

# Expected: {"data": {"id": "...", "name": "Test Segment"}}
# If error: Check terminal logs and fix issues
```

### Level 4: End-to-End Email Campaign Testing
```bash
# Test complete workflow:
# 1. Create segment through UI
# 2. Add contacts to segment  
# 3. Create campaign targeting segment
# 4. Launch campaign and verify emails send
# 5. Check campaign analytics update

# Expected: All steps complete successfully
# Emails appear in email provider's sent folder
# Campaign analytics show proper metrics
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No TypeScript errors: `npm run build`
- [ ] No linting errors: `npm run lint`
- [ ] API endpoints respond correctly
- [ ] UI components render without errors
- [ ] Email campaigns execute successfully with new feature
- [ ] Database operations complete without errors
- [ ] Real-time updates work correctly
- [ ] Authentication and permissions enforced
- [ ] Error handling works for edge cases
- [ ] Performance is acceptable (<3s for most operations)

---

## Anti-Patterns to Avoid
- ❌ Don't mix server and client Supabase patterns
- ❌ Don't skip authentication checks in API routes
- ❌ Don't hardcode values that should be configurable
- ❌ Don't ignore email provider rate limits
- ❌ Don't skip input validation on user data
- ❌ Don't use sync functions in async contexts
- ❌ Don't forget to handle campaign execution edge cases
- ❌ Don't ignore database transaction patterns
- ❌ Don't skip testing email sending functionality