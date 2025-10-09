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

#### Email Campaign System (`lib/campaigns.ts`, `lib/campaign-execution.ts`, `lib/campaign-processor.ts`)
- **Multi-step Sequences**: Up to 7 email steps with conditional logic
- **AI Personalization**: Template-based and custom prompt personalization
- **A/B Testing**: Subject line, content, and send time variants
- **Scheduling Engine**: Business hours, timezone detection, rate limiting
- **Batch Scheduling**: Intelligent batch creation with 20-minute intervals between batches
- **Execution Engine**: Job queue system with retry logic and batch processing
- **Campaign States**: draft → scheduled → sending → completed/paused/stopped
- **Status Tracking**: Real-time progress monitoring with batch-aware completion detection

#### Email Provider Integration (`lib/email-providers.ts`, `lib/oauth-providers.ts`)
- **Multi-provider Support**: Gmail (OAuth2), Outlook (OAuth2), Custom SMTP
- **Token Management**: Encrypted OAuth token storage with auto-refresh
- **Domain Authentication**: SPF, DKIM, DMARC validation and setup
- **Warmup System**: Automated email warmup with reputation monitoring
- **Rate Limiting**: Per-account, per-domain, and global rate limits

#### Contact Management (`lib/contacts.ts`, `lib/contact-segmentation.ts`, `lib/contact-engagement.ts`)
- **Contact Lists**: Bulk import, segmentation, and custom fields with advanced list management
- **Email Validation**: Real-time validation with status tracking
- **Engagement Tracking**: Opens, clicks, replies, and unsubscribes with automated scoring
- **Smart Segmentation**: Dynamic segments based on engagement and custom criteria
- **Engagement Scoring**: Automated calculation of contact engagement scores with decay factors
- **Contact Actions**: Dual-action interface for list management and contact operations

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
│   ├── stats/                # Contact analytics
│   └── recalculate-engagement/  # Engagement score recalculation
│       └── bulk/             # Bulk engagement recalculation
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

### Enhanced API Client Operations

#### DELETE Operations with Request Body
```typescript
// Enhanced DELETE method supports request body for bulk operations
await ApiClient.delete('/api/contacts/lists/{listId}/contacts', {
  contact_ids: ['id1', 'id2', 'id3']
})

// Standard DELETE without body still supported
await ApiClient.delete('/api/contacts/{contactId}')
```

#### Error Handling Strategy
```typescript
try {
  await ApiClient.delete(url, data)
} catch (error) {
  // Specific error handling based on status codes
  if (error.message.includes('401')) {
    // Handle authentication errors
  } else if (error.message.includes('404')) {
    // Handle not found errors
  }
}
```

### Enhanced ApiClient DELETE Operations
The `ApiClient.delete()` method supports request body data for complex deletion operations:
```typescript
// Delete with request body for bulk operations
await ApiClient.delete('/api/contacts/bulk', { contactIds: ['id1', 'id2'] })

// Simple delete without body
await ApiClient.delete('/api/contacts/123')
```

**Key Features:**
- **Request Body Support**: Pass data for bulk operations and complex deletions
- **Comprehensive Error Handling**: User-friendly messages for common HTTP status codes
- **Enhanced Logging**: Detailed request/response logging for debugging
- **Retry Logic**: Built-in error recovery and network timeout handling

### Error Handling
Standardized error responses across all routes with enhanced user messaging:
```typescript
// Standard API error response
return NextResponse.json(
  { error: 'Resource not found', code: 'NOT_FOUND' },
  { status: 404 }
)

// ApiClient error handling with user-friendly messages
try {
  await ApiClient.delete('/api/email-accounts/123')
} catch (error) {
  // Automatically converts HTTP status codes to user-friendly messages:
  // 401 → "Please sign in again to continue"
  // 403 → "You do not have permission to delete this email account"
  // 404 → "Email account not found. It may have already been deleted."
  // 429 → "Too many requests. Please wait a moment before trying again."
}
```

**Error Handling Features:**
- **Null Safety**: Safe array operations with `?.length || 0` patterns
- **Network Error Detection**: Specific handling for connection failures
- **Authentication Recovery**: Automatic token refresh and re-authentication prompts
- **Structured Logging**: Comprehensive error context for debugging

## MCP Server Integration

### When to Use MCP Servers

#### Supabase MCP (Database Operations)
**Always consult Supabase MCP when:**
- Creating, modifying, or reviewing database schema/migrations
- Adding new tables, columns, or constraints
- Implementing RLS (Row Level Security) policies
- Optimizing database queries or indexes
- Debugging database-related errors
- Validating SQL syntax and best practices

**How to use:**
```typescript
// Before making database changes, check with Supabase MCP:
// - Review existing schema with list_tables
// - Apply migrations with apply_migration
// - Execute queries with execute_sql for data operations
```

#### Context7 MCP (Framework & Library Documentation)
**Always consult Context7 MCP when:**
- Using Next.js App Router features (server actions, routing, middleware)
- Working with Radix UI components or shadcn/ui patterns
- Implementing Supabase client/server patterns
- Using React hooks or state management patterns
- Integrating third-party libraries or APIs
- Following framework-specific best practices

**How to use:**
```typescript
// Before implementing framework features:
// 1. Use resolve-library-id to find the library (e.g., "next.js", "supabase")
// 2. Use get-library-docs with specific topics (e.g., "server actions", "authentication")
// 3. Apply the recommended patterns from official documentation
```

### MCP Integration Best Practices
1. **Database First**: Check Supabase MCP before any schema changes
2. **Documentation Second**: Verify framework patterns with Context7 MCP
3. **Test After**: Validate changes work as expected
4. **Document Changes**: Update CLAUDE.md if patterns change

## Development Guidelines

### Component Patterns
- **Server Components**: Default for data fetching and static content
- **Client Components**: Use `"use client"` only for interactivity
- **Supabase Integration**: Use appropriate client (browser vs server) for context
- **Real-time Updates**: Implement subscriptions for live data updates

#### ContactCard Component Pattern
```typescript
interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contactId: string) => void
  onRemoveFromList?: (contactId: string) => void // Optional for list context
  onAddTag: (contactId: string) => void
  onClick?: (contact: Contact) => void
  showRemoveFromList?: boolean // Controls dropdown menu options
}

// Event propagation control for dropdown actions
<DropdownMenuItem onClick={(e) => {
  e.stopPropagation() // Prevents card onClick from firing
  onRemoveFromList(contact.id)
}}>
  <UserX className="h-4 w-4 mr-2" />
  Remove from List
</DropdownMenuItem>
```

#### ConfirmationDialog System
```typescript
// Reusable confirmation dialog with variant support
<ConfirmationDialog
  open={confirmDialog.open}
  onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
  title="Remove Contact from List"
  description="Are you sure you want to remove John Doe from 'Marketing List'?"
  variant="default" // or "destructive" for dangerous actions
  confirmText="Remove"
  cancelText="Cancel"
  onConfirm={handleConfirmedAction}
/>
```

#### ContactCard Component Pattern
Enhanced contact cards with dual-action interfaces and event handling:
```typescript
// Dual-action dropdown pattern with context-sensitive options
<DropdownMenu>
  <DropdownMenuItem onClick={(e) => {
    e.stopPropagation() // Prevent card click propagation
    onEdit(contact)
  }}>
    <Edit className="h-4 w-4 mr-2" />
    Edit
  </DropdownMenuItem>
  {showRemoveFromList && onRemoveFromList && (
    <DropdownMenuItem onClick={(e) => {
      e.stopPropagation()
      onRemoveFromList(contact.id)
    }}>
      <UserX className="h-4 w-4 mr-2" />
      Remove from List
    </DropdownMenuItem>
  )}
</DropdownMenu>
```

**Key Patterns:**
- **Event Propagation Control**: Use `e.stopPropagation()` to prevent card click when interacting with buttons
- **Conditional Actions**: Show context-specific actions (e.g., "Remove from List" only in list views)
- **Null-Safe Operations**: Handle missing data with `contact.lists?.length || 0`
- **Selection State Management**: Controlled checkbox state with proper event handling

#### ConfirmationDialog System
Reusable confirmation dialogs for destructive actions:
```typescript
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

// Usage example
<ConfirmationDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Contact"
  description="Are you sure you want to delete this contact? This action cannot be undone."
  confirmText="Delete Contact"
  variant="destructive"
  onConfirm={() => handleDeleteContact(contactId)}
/>
```

**Features:**
- **Variant Support**: `default` and `destructive` styling variants
- **Auto-close**: Automatically closes dialog after action completion
- **Accessibility**: Full keyboard navigation and screen reader support
- **Flexible Content**: Customizable title, description, and button text

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

#### Enhanced Testing for Contact Management
**Component Testing Patterns:**
```bash
# Test ContactCard interactions
npm test -- --testPathPattern=ContactCard
npm test -- --testPathPattern=ConfirmationDialog

# Test API client enhancements
npm test -- --testPathPattern=api-client
npm test -- --testPathPattern=contact-engagement
```

**Key Testing Areas:**
- **Event Propagation**: Verify `stopPropagation()` prevents unwanted card clicks
- **Null Safety**: Test array operations with `undefined`/`null` values
- **Confirmation Flows**: Test dialog open/close states and action execution
- **API Error Handling**: Mock network failures and HTTP error codes
- **Engagement Scoring**: Validate score calculation and decay algorithms

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

### Contact Management Patterns

#### Dual-Action Contact Operations
```typescript
// Distinguish between removing from list vs permanent deletion
const handleRemoveFromList = (contactId: string) => {
  setConfirmDialog({
    open: true,
    title: 'Remove Contact from List',
    description: `Contact will remain in your database and other lists.`,
    variant: 'default',
    action: () => performRemoveFromList([contactId])
  })
}

const handleDeleteContact = (contactId: string) => {
  setConfirmDialog({
    open: true,
    title: 'Delete Contact Permanently',
    description: `This action cannot be undone. Contact will be removed from all lists.`,
    variant: 'destructive',
    action: () => performDeleteContact(contactId)
  })
}
```

#### Null-Safe Array Operations
```typescript
// Always provide fallback for potentially undefined arrays
const updatedList = {
  ...list,
  contact_ids: (list.contact_ids || []).filter(id => !contactIds.includes(id))
}

// Safe length checks
const contactCount = contact.lists?.length || 0
```

#### Event Propagation Management
```typescript
// Prevent unwanted interactions in nested components
const handleAction = (e: React.MouseEvent, contactId: string) => {
  e.stopPropagation() // Essential for dropdown menus in clickable cards
  performAction(contactId)
}
```

#### Confirmation Dialog State Management
```typescript
// Reusable confirmation dialog pattern
const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean
  title: string
  description: string
  action: () => void
  variant?: 'default' | 'destructive'
}>({ open: false, title: '', description: '', action: () => {} })

// Usage in component
const showConfirmation = (title: string, description: string, action: () => void) => {
  setConfirmDialog({ open: true, title, description, action, variant: 'destructive' })
}
```

### Campaign Execution Flow
1. **Campaign Creation**: Validate sequence and settings
2. **Contact Selection**: Apply segmentation and filters
3. **Batch Schedule Creation**: Generate time-distributed batch schedule with all batches upfront
4. **Job Scheduling**: Create email jobs based on batch timing rules
5. **Email Processing**: Apply personalization and send emails per batch
6. **Batch Status Tracking**: Mark batches as 'sent' and monitor completion
7. **Engagement Tracking**: Monitor opens, clicks, and replies
8. **Sequence Logic**: Progress contacts based on conditions

### Batch Scheduling System
The campaign system uses intelligent batch scheduling to distribute emails over time and avoid triggering spam filters.

#### Batch Schedule Creation (`src/app/api/campaigns/simple/route.ts:218-273`)
When a campaign is created, the system immediately generates a complete batch schedule:

```typescript
// Example: 20 contacts with batch size 5 = 4 batches
const batchSize = 5 // From daily_send_limit
const totalContacts = 20
const totalBatches = Math.ceil(totalContacts / batchSize) // = 4
const BATCH_INTERVAL_MINUTES = 20

const batches = [
  {
    batch_number: 1,
    scheduled_time: "2025-10-09T10:00:00Z",
    contact_ids: ["id1", "id2", "id3", "id4", "id5"],
    contact_count: 5,
    status: 'pending'
  },
  {
    batch_number: 2,
    scheduled_time: "2025-10-09T10:20:00Z", // +20 minutes
    contact_ids: ["id6", "id7", "id8", "id9", "id10"],
    contact_count: 5,
    status: 'pending'
  },
  // ... batches 3 and 4
]
```

**Key Features:**
- **Upfront Scheduling**: All batches created at campaign start, not dynamically
- **Fixed Intervals**: 20-minute spacing between batches
- **Contact Assignment**: Each batch has specific contact IDs assigned
- **Persistent Storage**: Batch schedule saved to `campaigns.batch_schedule` (JSONB)

#### Batch Processing (`lib/campaign-processor.ts:289-320`)
The campaign processor runs every 30 seconds and processes batches when ready:

```typescript
// Find next pending batch that's ready to send
const now = new Date()
const pendingBatch = campaign.batch_schedule.batches.find(batch =>
  batch.status === 'pending' &&
  new Date(batch.scheduled_time) <= now
)

if (pendingBatch) {
  // Process this batch's contacts
  const contacts = await getContacts(pendingBatch.contact_ids)
  await sendEmailsForBatch(contacts)

  // Mark batch as sent
  batch.status = 'sent'
  batch.completed_at = new Date().toISOString()
}
```

#### Campaign Status Determination (`lib/campaign-processor.ts:966-996`)
Campaign status is determined by batch completion state:

```typescript
const allBatchesSent = batches.every(b => b.status === 'sent')
const nextPendingBatch = batches.find(b => b.status === 'pending')

if (nextPendingBatch) {
  // More batches to process
  status = 'sending'
  next_batch_send_time = nextPendingBatch.scheduled_time
} else if (allBatchesSent) {
  // ALL batches completed
  status = 'completed'
  end_date = new Date().toISOString()
} else {
  // No pending batches but not all sent (error state)
  status = 'sending'
  next_batch_send_time = null
}
```

**Status Logic:**
- `'sending'`: Has pending batches OR processing current batch
- `'completed'`: ALL batches have `status === 'sent'`
- `'paused'`: User manually paused
- `'stopped'`: User manually stopped

**Important**: Campaign is NOT marked complete just because no batches are ready now. It must verify ALL batches are actually sent.

#### Diagnostic Logging
Enhanced logging helps debug batch scheduling issues:

```typescript
// Example log output:
📅 Using batch schedule for campaign xxx
📊 Total batches: 4
📊 Batch status summary:
   Batch 1: sent - scheduled for 2025-10-09T10:00:00Z
   Batch 2: sent - scheduled for 2025-10-09T10:20:00Z
   Batch 3: pending - scheduled for 2025-10-09T10:40:00Z
   Batch 4: pending - scheduled for 2025-10-09T11:00:00Z
🕐 Current time: 2025-10-09T10:35:00Z
📧 Processing batch 3/4
```

#### Troubleshooting Batch Campaigns
Common issues and solutions:

**Campaign shows "Completed" but only partial emails sent:**
- **Cause**: Old bug where campaigns marked complete when no pending batches found
- **Fix**: v0.20.2 - Now verifies ALL batches are 'sent' before completion
- **Check**: Look for batches with `status: 'pending'` in `campaigns.batch_schedule`

**Batches not processing:**
- **Check 1**: Verify `scheduled_time` is in the past for pending batches
- **Check 2**: Ensure campaign processor cron is running (`/api/cron/process-campaigns`)
- **Check 3**: Review logs for errors during batch processing
- **Debug**: Check `campaigns.next_batch_send_time` - should match next pending batch

**Wrong batch count:**
- **Check**: `batch_schedule.total_batches` should equal `Math.ceil(total_contacts / batch_size)`
- **Verify**: All contact IDs in batches match campaign's contact lists
- **Fix**: May need to recreate batch schedule if corrupted

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

### Contact Engagement Management
Enhanced contact engagement system with automated scoring and recalculation:
```typescript
// Single contact engagement recalculation
await ApiClient.post('/api/contacts/recalculate-engagement', { contactId })

// Bulk engagement recalculation for all user contacts
await ApiClient.post('/api/contacts/recalculate-engagement')

// Engagement scoring example
const engagementResult = await recalculateContactEngagement(supabase, contactId)
// Returns: { status, score, sentCount, openCount, clickCount, replyCount, bounceCount }
```

**Engagement System Features:**
1. **Automated Scoring**: Opens (+5 max 15), clicks (+20 max 60), replies (+50 unlimited)
2. **Decay Factor**: 30-day rolling window with 0.7 decay factor for time-based scoring
3. **Status Classification**: not_contacted → pending → engaged → bad (based on bounces/complaints)
4. **Hard Stop Detection**: Automatic marking of bounced, complained, or unsubscribed contacts
5. **Bulk Processing**: Efficient recalculation of all user contacts with null safety

### Confirmation Dialog Pattern
Standardized user action confirmation system:
```typescript
const [confirmState, setConfirmState] = useState({
  open: false,
  title: '',
  description: '',
  action: null as (() => void) | null
})

// Show confirmation
const showConfirmation = (title: string, description: string, action: () => void) => {
  setConfirmState({ open: true, title, description, action })
}

// Execute confirmed action
const handleConfirm = () => {
  confirmState.action?.()
  setConfirmState({ open: false, title: '', description: '', action: null })
}
```

**Usage Patterns:**
- **Destructive Actions**: Delete contacts, remove from lists, clear data
- **Bulk Operations**: Multi-select actions with count confirmation
- **State Management**: Consistent open/close handling across components
- **Action Queuing**: Store action callbacks for delayed execution

### Event Propagation Management
Best practices for complex UI interactions:
```typescript
// Prevent card click when interacting with buttons
const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
  e.stopPropagation() // Essential for nested interactive elements
  action()
}

// Safe checkbox handling with propagation control
const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  e.stopPropagation() // Prevent parent element clicks
  if (onSelect) {
    onSelect(contact.id, e.target.checked)
  }
}
```

**Key Principles:**
- **Selective Propagation**: Stop propagation only on interactive elements
- **Event Bubbling**: Allow natural bubbling for non-conflicting events
- **Dropdown Menus**: Always prevent propagation on dropdown triggers and items
- **Form Elements**: Isolate form interactions from parent click handlers

### Null-Safe Array Operations
Defensive programming patterns for data handling:
```typescript
// Safe array length checking
const listsCount = contact.lists?.length || 0
const tagsCount = contact.tags?.length || 0

// Safe array slicing and mapping
const displayTags = contact.tags?.slice(0, 4) || []
const extraTagsCount = Math.max(0, (contact.tags?.length || 0) - 4)

// Safe array iteration with early returns
if (!contacts || contacts.length === 0) {
  return <EmptyState message="No contacts found" />
}

// Safe property access with fallbacks
const contactName = contact.first_name || contact.last_name ||
                   parseCompanyName(contact.company) || contact.email
```

**Safety Patterns:**
- **Optional Chaining**: Use `?.` for potentially undefined nested properties
- **Null Coalescing**: Use `||` for fallback values when arrays might be null/undefined
- **Length Validation**: Check array existence before accessing length property
- **Early Returns**: Exit early when required data is missing rather than continuing with null values

## Troubleshooting

### Common Issues
- **Authentication Loops**: Check middleware.ts - it's configured to pass through all routes to avoid conflicts
- **Database Connection**: Verify Supabase environment variables and network access
- **Email Sending**: Ensure provider credentials are valid and domain authentication is set up
- **Campaign Not Starting**: Check contact list validity and email account status

#### Contact Management Issues
- **Event Propagation Conflicts**: Ensure `e.stopPropagation()` is used in dropdown menus and button handlers
- **Null Reference Errors**: Use safe array operations with `?.length || 0` patterns
- **Engagement Score Errors**: Check that all required fields exist before recalculation
- **Confirmation Dialog Not Closing**: Verify `onOpenChange` handler resets dialog state properly
- **API Delete Failures**: Check network logs for request body format and authentication headers

#### UI Component Issues
- **ContactCard Selection**: Checkbox clicks should not trigger card clicks (use `stopPropagation`)
- **Dropdown Menu Positioning**: Ensure parent containers allow overflow for dropdown menus
- **Loading States**: Show loading indicators during API operations to prevent user confusion
- **Optimistic Updates**: Implement optimistic UI updates for better user experience

### Debug Tools
- Use `/debug-auth` page for authentication troubleshooting
- Check browser network tab for API response details
- Monitor Supabase dashboard for real-time database activity
- Use `console.log` in API routes - they appear in terminal, not browser console

#### Enhanced Debugging for Contact Management
- **ApiClient Logging**: Enhanced request/response logging with detailed error context
- **Engagement Score Debugging**: Log scoring calculations and decay factor applications
- **Event Handler Debugging**: Add console logs to verify event propagation behavior
- **Confirmation Dialog State**: Monitor dialog state changes in React DevTools
- **Component Props**: Use React DevTools to verify prop passing and state updates

### Performance Considerations
- **Pagination**: Implement for large contact lists and campaign history
- **Caching**: Use Supabase real-time subscriptions instead of polling
- **Batch Operations**: Process email sends in configurable batch sizes
- **Index Usage**: Ensure database queries use appropriate indexes for large datasets

#### Contact Management Performance
- **Engagement Calculation**: Bulk recalculation processes contacts in batches to prevent timeouts
- **UI Optimization**: Use React.memo for ContactCard components to prevent unnecessary re-renders
- **Event Handler Optimization**: Debounce search inputs and selection changes
- **Large List Handling**: Implement virtual scrolling for lists with >1000 contacts
- **API Client Efficiency**: Request body support reduces multiple API calls for bulk operations