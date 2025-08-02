# Design Document

## Overview

The new contacts UI will be a standalone page at `/contacts` that bypasses the complex authentication wrapper and directly handles session management. It will use the existing contact service functions but with a simplified, more reliable architecture that focuses on functionality over complex authentication flows.

## Architecture

### Route Structure
- **New Route:** `/contacts` (instead of `/dashboard/contacts`)
- **Direct API Integration:** Bypass AuthProvider/ProtectedRoute wrapper
- **Session Handling:** Direct Supabase client integration with fallback handling

### Component Hierarchy
```
ContactsPage (new)
├── ContactsHeader (simplified header)
├── ContactsStats (statistics cards)
├── ContactsFilters (search and filter controls)
├── ContactsList (main contact display)
├── ContactCard (individual contact item)
├── AddContactModal (contact creation)
├── ImportContactsModal (CSV import)
└── BulkActionsBar (multi-select actions)
```

## Components and Interfaces

### ContactsPage Component
**Purpose:** Main page component that handles all contact management
**Key Features:**
- Direct Supabase session management
- State management for contacts, filters, and selections
- Error handling with user-friendly messages
- Loading states for all operations

```typescript
interface ContactsPageState {
  contacts: Contact[]
  stats: ContactStats | null
  loading: boolean
  error: string | null
  searchTerm: string
  statusFilter: string
  selectedContacts: string[]
  pagination: PaginationState
}
```

### ContactsHeader Component
**Purpose:** Simple header with branding and basic user info
**Features:**
- App branding
- User email display (from session)
- Simple sign-out button
- No complex authentication dependencies

### ContactsStats Component
**Purpose:** Display contact statistics in card format
**Features:**
- Total contacts count
- Status breakdown (active, unsubscribed, bounced)
- Loading placeholders
- Error handling for stats API failures

### ContactsFilters Component
**Purpose:** Search and filter controls
**Features:**
- Real-time search input
- Status dropdown filter
- Clear filters button
- Responsive design for mobile

### ContactsList Component
**Purpose:** Main contact display with grid/list view
**Features:**
- Responsive grid layout
- Infinite scroll or pagination
- Empty state handling
- Loading skeletons
- Select all functionality

### ContactCard Component
**Purpose:** Individual contact display and actions
**Features:**
- Contact information display
- Individual actions (edit, delete, tag)
- Selection checkbox
- Status indicators
- Hover effects and interactions

## Data Models

### Contact Interface (Reuse Existing)
```typescript
interface Contact {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  company?: string
  position?: string
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  tags: string[]
  created_at: string
  updated_at: string
}
```

### ContactStats Interface (Reuse Existing)
```typescript
interface ContactStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  by_status: Record<string, number>
  by_tags: Record<string, number>
}
```

## Error Handling

### Authentication Errors
- **Strategy:** Direct session checking with graceful degradation
- **Fallback:** Show login prompt within the page instead of redirecting
- **Recovery:** Retry mechanism for session refresh

### API Errors
- **Display:** Toast notifications for temporary errors
- **Persistence:** Error banners for critical failures
- **Recovery:** Retry buttons for failed operations

### Network Errors
- **Detection:** Timeout and connection error handling
- **User Feedback:** Clear error messages with suggested actions
- **Retry Logic:** Exponential backoff for API retries

## Testing Strategy

### Unit Tests
- Contact service function integration
- Component state management
- Error handling scenarios
- Filter and search functionality

### Integration Tests
- API endpoint interactions
- Session management flows
- Bulk operations
- CSV import functionality

### User Acceptance Tests
- Complete contact management workflows
- Error recovery scenarios
- Mobile responsiveness
- Performance with large contact lists

## Implementation Approach

### Phase 1: Core Structure
1. Create new `/contacts` route
2. Implement basic ContactsPage component
3. Add direct session management
4. Create ContactsList with basic display

### Phase 2: Essential Features
1. Add ContactsStats component
2. Implement search and filtering
3. Add contact creation modal
4. Basic error handling

### Phase 3: Advanced Features
1. Bulk operations
2. CSV import functionality
3. Enhanced error handling
4. Performance optimizations

### Phase 4: Polish
1. Loading states and animations
2. Mobile responsiveness
3. Accessibility improvements
4. User experience enhancements

## Technical Decisions

### Session Management
- **Decision:** Use direct Supabase client instead of AuthProvider
- **Rationale:** Avoid complex authentication wrapper issues
- **Implementation:** Check session on component mount with fallback handling

### API Integration
- **Decision:** Reuse existing ContactService and API endpoints
- **Rationale:** Leverage tested, working backend functionality
- **Implementation:** Direct API calls with proper error handling

### State Management
- **Decision:** Use React useState and useEffect
- **Rationale:** Keep it simple, avoid complex state management
- **Implementation:** Local component state with clear data flow

### Styling
- **Decision:** Reuse existing Tailwind CSS and UI components
- **Rationale:** Maintain design consistency
- **Implementation:** Use existing component library where possible

## Performance Considerations

### Data Loading
- Implement pagination for large contact lists
- Use loading skeletons for better perceived performance
- Cache contact data to reduce API calls

### Search and Filtering
- Debounce search input to reduce API calls
- Client-side filtering for small datasets
- Server-side filtering for large datasets

### Bulk Operations
- Batch API calls for bulk actions
- Progress indicators for long-running operations
- Optimistic updates where appropriate