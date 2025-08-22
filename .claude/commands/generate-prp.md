# Generate PRP Command

## Purpose
Generate a comprehensive Product Requirements Prompt (PRP) for email marketing features in the pitchdonkey project.

## Command
/generate-prp

## Usage
```bash
/generate-prp INITIAL.md
/generate-prp features/new-email-templates.md
```

## Implementation

```markdown
I need to generate a comprehensive PRP for implementing the feature described in: $ARGUMENTS

## Step 1: Research Current Codebase Patterns

First, let me understand the current architecture and patterns in the pitchdonkey project:

### Architecture Analysis
- Read and analyze CLAUDE.md for project guidelines
- Examine lib/ directory for core business logic patterns
- Review components/ directory for UI component patterns  
- Check src/app/api/ for API route patterns
- Analyze database schema in lib/database-schema.sql

### Pattern Detection
- Email campaign execution patterns in lib/campaign-execution.ts
- Authentication patterns in lib/auth.ts and lib/supabase-*.ts
- Email provider integration in lib/email-providers.ts
- Contact management in lib/contacts.ts
- AI personalization patterns in lib/ai-providers.ts

## Step 2: Read Feature Requirements

Read the feature request file: $ARGUMENTS

Extract:
- FEATURE: What needs to be built
- EXAMPLES: Relevant code examples to follow
- DOCUMENTATION: External resources needed
- OTHER CONSIDERATIONS: Important constraints and requirements

## Step 3: Research External Documentation

Based on the feature requirements, fetch relevant documentation:
- Supabase documentation for database operations
- Next.js App Router documentation for API routes
- Radix UI documentation for components
- Email provider APIs (Gmail, Outlook, SMTP)
- AI provider documentation (OpenAI, Anthropic)

## Step 4: Generate Comprehensive PRP

Create a detailed PRP following the template structure:

### Goal
Clear statement of what needs to be implemented

### Why
- Business value for email marketing campaigns
- Integration with existing campaign system
- User impact and workflow improvements

### What
- Technical requirements and user-facing behavior
- Success criteria with measurable outcomes

### All Needed Context
- Documentation URLs and specific sections
- Code example files and patterns to follow
- Database schema requirements
- External API documentation

### Current Codebase Tree
Run `find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -E "(lib|components|src)" | head -30` to show structure

### Desired Codebase Tree
Show where new files will be added and their responsibilities

### Known Gotchas
- Next.js App Router specific patterns
- Supabase client vs server-side usage
- Email provider authentication quirks
- Campaign execution timing considerations
- Database transaction patterns

### Implementation Blueprint

#### Data Models
Show required TypeScript interfaces and Zod schemas

#### Task List
Break down implementation into ordered tasks:
- Database schema updates
- API route creation
- Component development  
- Integration points
- Testing requirements

#### Per-task Pseudocode
Provide detailed pseudocode with:
- Pattern references from existing codebase
- Critical implementation details
- Error handling approaches

### Integration Points
- Database migrations needed
- API route additions
- Component integration points
- Authentication requirements

### Validation Loop
- Level 1: TypeScript compilation and linting
- Level 2: Unit tests for new functionality
- Level 3: Integration tests with email providers
- Level 4: End-to-end campaign testing

### Final Validation Checklist
- All tests pass
- No TypeScript errors
- Email campaigns execute successfully
- Authentication works correctly
- UI components render properly

## Step 5: Create PRP File

Save the generated PRP as:
`PRPs/{feature-name}-{timestamp}.md`

Where feature-name is extracted from the INITIAL.md requirements.

## Step 6: Confidence Assessment

Provide a confidence score (1-10) based on:
- Availability of similar patterns in codebase
- Completeness of external documentation
- Complexity of integration points
- Test coverage possibilities

## Success Criteria

- [ ] PRP contains all necessary context for implementation
- [ ] Implementation steps are detailed and ordered
- [ ] Validation loops are comprehensive
- [ ] External documentation is referenced appropriately
- [ ] Existing patterns are leveraged correctly
```