# PitchDonkey Code Examples

This directory contains code examples that demonstrate patterns and conventions used throughout the PitchDonkey email marketing platform. These examples serve as references for implementing new features following established patterns.

## Directory Structure

```
examples/
├── README.md                    # This file
├── api-routes/                  # Next.js API route patterns
│   ├── campaign-api.ts         # Campaign CRUD operations
│   ├── contact-api.ts          # Contact management API
│   └── auth-api.ts             # Authentication patterns
├── business-logic/              # Core business logic patterns
│   ├── campaign-execution.ts   # Email campaign processing
│   ├── email-providers.ts      # Multi-provider integration
│   └── contact-segmentation.ts # Contact segmentation logic
├── components/                  # React component patterns
│   ├── campaign-forms.tsx      # Form handling with validation
│   ├── data-tables.tsx         # Data display and interaction
│   └── real-time-updates.tsx   # Supabase real-time subscriptions
├── database/                    # Database operation patterns
│   ├── migrations.sql          # Schema migration examples
│   ├── queries.ts              # Complex query patterns
│   └── transactions.ts         # Transaction handling
├── testing/                     # Testing patterns and utilities
│   ├── api-tests.ts            # API route testing
│   ├── component-tests.tsx     # React component testing
│   └── business-logic-tests.ts # Unit testing patterns
└── integrations/               # External service integration
    ├── email-oauth.ts          # OAuth flow handling
    ├── ai-personalization.ts  # AI provider integration
    └── webhook-handlers.ts     # Webhook processing
```

## Key Patterns Demonstrated

### 1. Authentication & Authorization
- Plan-based permission checking
- Supabase server vs client usage
- JWT token handling

### 2. Email Campaign System
- Campaign creation and validation
- Email sequence execution
- Multi-step campaign logic
- A/B testing implementation

### 3. Email Provider Integration  
- OAuth flow handling (Gmail, Outlook)
- SMTP configuration
- Token refresh and encryption
- Rate limiting and error handling

### 4. Database Operations
- Supabase client patterns
- Real-time subscriptions
- Complex queries with joins
- Transaction handling

### 5. UI Components
- Form validation with Zod
- Radix UI integration
- Loading and error states
- Responsive design patterns

### 6. API Route Implementation
- Next.js App Router patterns
- Request validation
- Error handling
- Response formatting

### 7. Testing Strategies
- Unit testing with Jest
- API route testing
- Component testing
- Mock patterns

## Usage Guidelines

When implementing new features:

1. **Review relevant examples** before starting implementation
2. **Follow the same patterns** for consistency
3. **Adapt examples** to your specific use case
4. **Update examples** when creating new patterns
5. **Reference examples** in PRPs for context

## Pattern Conventions

### File Naming
- Use kebab-case for files: `email-campaign-service.ts`
- Use PascalCase for components: `EmailCampaignForm.tsx`
- Use UPPER_CASE for constants: `MAX_CAMPAIGN_STEPS`

### Import Conventions
```typescript
// External imports first
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Internal imports second
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

// Relative imports last
import './styles.css'
```

### Error Handling
```typescript
// Consistent error response format
return NextResponse.json(
  { error: 'Resource not found', code: 'NOT_FOUND' },
  { status: 404 }
)
```

### Database Patterns
```typescript
// Always use proper client for context
const supabase = createServerSupabaseClient() // API routes
const supabase = createClientSupabase() // React components
```

## Integration Examples

Each subdirectory contains examples relevant to specific aspects of the platform:

- **api-routes/**: How to structure Next.js API routes with proper authentication and validation
- **business-logic/**: Core business logic patterns for campaigns, contacts, and email processing
- **components/**: React component patterns with proper TypeScript and styling
- **database/**: Database operation patterns and query optimization
- **testing/**: Comprehensive testing approaches for different layers
- **integrations/**: External service integration patterns

## Best Practices Highlighted

1. **Type Safety**: All examples use proper TypeScript types
2. **Validation**: Input validation using Zod schemas
3. **Error Handling**: Comprehensive error handling patterns
4. **Authentication**: Consistent authentication patterns
5. **Performance**: Optimized database queries and caching
6. **Testing**: Comprehensive test coverage examples
7. **Documentation**: Well-documented code with clear examples

## Contributing New Examples

When adding new examples:

1. Follow existing naming conventions
2. Include comprehensive TypeScript types
3. Add inline comments explaining patterns
4. Include both success and error cases
5. Update this README with new pattern descriptions
6. Ensure examples are production-ready code