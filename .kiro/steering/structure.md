# Project Structure & Organization

## Root Directory Structure

```
├── .kiro/                    # Kiro IDE configuration and specs
├── components/               # Reusable React components
├── lib/                     # Shared utilities and services
├── src/app/                 # Next.js App Router pages and API routes
├── __tests__/               # Test files
├── design-templates/        # UI/UX design specifications
└── web-ui/                  # Static HTML prototypes
```

## Key Directories

### `/components/`
Organized by feature domains:
- `ai/` - AI personalization components
- `auth/` - Authentication components
- `contacts/` - Contact management components
- `email-accounts/` - Email account management components
- `ui/` - Base UI components (buttons, dialogs, etc.)

### `/lib/`
Core business logic and utilities:
- `auth.ts` - Authentication helpers
- `database.types.ts` - TypeScript database types
- `supabase.ts` - Database client configuration
- `domain-auth.ts` - Email domain authentication
- `email-providers.ts` - Email service integrations
- `ai-providers.ts` - AI service integrations
- `validations.ts` - Zod validation schemas
- `errors.ts` - Custom error classes
- `utils.ts` - General utilities

### `/src/app/`
Next.js App Router structure:
- `api/` - API route handlers organized by resource
- `dashboard/` - Main application pages
- `auth/` - Authentication pages
- `globals.css` - Global styles
- `layout.tsx` - Root layout component

### `/src/app/api/`
API routes organized by resource:
- `ai/` - AI personalization endpoints
- `contacts/` - Contact management endpoints
- `email-accounts/` - Email account endpoints
- `users/` - User management endpoints

## File Naming Conventions

### Components
- Use PascalCase: `EmailAccountCard.tsx`
- Include component type in name: `AddContactDialog.tsx`
- Co-locate related components in feature folders

### API Routes
- Use kebab-case for directories: `email-accounts/`
- Dynamic routes: `[id]/` for single resources
- Nested actions: `[id]/verify-domain/route.ts`

### Library Files
- Use kebab-case: `domain-auth.ts`
- Descriptive names indicating purpose: `smtp-providers.ts`

### Test Files
- Mirror source structure in `__tests__/`
- Use `.test.ts` or `.test.tsx` suffix
- Group by feature: `__tests__/lib/domain-auth.test.ts`

## Import Conventions

### Path Aliases
- Use `@/` for root-relative imports
- Example: `import { Button } from '@/components/ui/button'`

### Import Order
1. External libraries (React, Next.js, etc.)
2. Internal utilities (`@/lib/`)
3. Internal components (`@/components/`)
4. Relative imports (`./`, `../`)

## Component Organization

### UI Components (`/components/ui/`)
- Base design system components
- Use Radix UI primitives with custom styling
- Export both component and variant functions
- Include TypeScript interfaces for props

### Feature Components
- Group by business domain
- Include related dialogs and forms in same folder
- Use composition over inheritance
- Implement proper error boundaries

## Database Schema Organization

### Table Naming
- Use snake_case: `email_accounts`, `ai_templates`
- Descriptive names indicating purpose
- Consistent foreign key naming: `user_id`, `contact_id`

### Type Generation
- Auto-generated types in `lib/database.types.ts`
- Comprehensive Row/Insert/Update interfaces
- JSON field typing for complex data structures

## Testing Structure

### Test Organization
- Mirror source directory structure
- Group tests by feature area
- Use descriptive test names
- Mock external dependencies (DNS, APIs)

### Test Patterns
- Unit tests for business logic in `/lib/`
- Integration tests for API routes
- Component tests for UI interactions
- Use Jest with jsdom environment