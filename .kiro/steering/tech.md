# Technology Stack & Development Guidelines

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode disabled)
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with custom styling
- **Icons**: Lucide React
- **State Management**: React hooks and server state

### Backend
- **Runtime**: Node.js with Next.js API routes
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with OAuth (Google, Microsoft)
- **Caching**: Redis via Upstash
- **Email Delivery**: Nodemailer with SMTP/OAuth
- **AI Integration**: OpenAI GPT-4 and Anthropic Claude APIs

### Infrastructure
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel (implied by Next.js setup)
- **Environment**: Environment variables for configuration

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Testing
```bash
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Key Dependencies
- `@supabase/supabase-js` - Database and auth client
- `next-auth` - Authentication framework
- `zod` - Runtime type validation
- `googleapis` & `@microsoft/microsoft-graph-client` - OAuth integrations
- `nodemailer` - Email sending
- `openai` - AI personalization
- `class-variance-authority` - Component variant management

## Development Patterns
- Use TypeScript for all new code
- Validate API inputs with Zod schemas
- Handle errors with custom error classes
- Use Supabase client for database operations
- Implement proper authentication checks in API routes
- Follow Next.js App Router conventions