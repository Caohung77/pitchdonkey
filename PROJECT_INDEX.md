# Pitchdonkey Project Index

> **Version:** v0.17.7
> **Project Name:** coldreach-pro
> **Framework:** Next.js 15.4.6 with App Router
> **Database:** Supabase (PostgreSQL)
> **Last Updated:** October 12, 2025

## 🏗️ Project Overview

Pitchdonkey is a comprehensive cold email outreach platform with AI-powered personalization, multi-provider email support, and advanced campaign management.

### Core Features
- 📧 Multi-provider email integration (Gmail OAuth, Outlook OAuth, Custom SMTP)
- 🤖 AI-powered email personalization (OpenAI, Anthropic, Google Gemini)
- 📊 Advanced campaign management with batch scheduling
- 👥 Contact management with engagement tracking and segmentation
- 📬 Inbox management with autonomous reply system
- 🎯 Domain authentication (SPF, DKIM, DMARC)
- 📈 Real-time analytics and reporting
- 🔄 Email warmup and deliverability optimization

## 📂 Project Structure

```
pitchdonkey/
├── 📄 CLAUDE.md                   # AI assistant instructions
├── 📄 PROJECT_INDEX.md            # This file - project navigation hub
├── 📄 DOCUMENTATION_INDEX.md      # Documentation navigation
├── 📦 package.json                # Dependencies and scripts
├── ⚙️ next.config.js              # Next.js configuration
├── ⚙️ tsconfig.json               # TypeScript configuration
├── ⚙️ tailwind.config.js          # Tailwind CSS configuration
│
├── 📁 src/                        # Application source code
│   ├── app/                       # Next.js App Router pages
│   │   ├── api/                   # API routes
│   │   ├── (auth)/                # Authentication pages
│   │   ├── (dashboard)/           # Dashboard pages
│   │   └── layout.tsx             # Root layout
│   ├── components/                # React components (legacy location)
│   └── lib/                       # Utilities (legacy location)
│
├── 📁 components/                 # Shared React components
│   ├── ui/                        # shadcn/ui components
│   ├── campaigns/                 # Campaign-specific components
│   ├── contacts/                  # Contact management components
│   ├── email-accounts/            # Email account components
│   └── analytics/                 # Analytics components
│
├── 📁 lib/                        # Core business logic
│   ├── supabase*.ts               # Supabase client/server setup
│   ├── auth.ts                    # Authentication utilities
│   ├── campaigns.ts               # Campaign management
│   ├── contacts.ts                # Contact management
│   ├── email-providers.ts         # Email provider integrations
│   ├── oauth-providers.ts         # OAuth implementations
│   └── database.types.ts          # TypeScript database types
│
├── 📁 hooks/                      # React custom hooks
│   ├── useAuth.ts                 # Authentication hook
│   ├── useCampaigns.ts            # Campaign management hook
│   └── useContacts.ts             # Contact management hook
│
├── 📁 supabase/                   # Database management
│   ├── migrations/                # Database migrations (26 files)
│   ├── schemas/                   # Schema definitions (12 files)
│   ├── fixes/                     # Fix scripts (21 files)
│   ├── archive/                   # Deprecated scripts (16 files)
│   └── README.md                  # Database documentation
│
├── 📁 docs/                       # Project documentation
│   ├── documentation/             # Current docs (29 files)
│   ├── fixes/                     # Fix documentation (22 files)
│   ├── archive/                   # Deprecated docs (10 files)
│   └── README.md                  # Documentation organization
│
├── 📁 scripts/                    # Utility scripts
│   └── migrations/                # Migration scripts
│
├── 📁 public/                     # Static assets
│   ├── images/
│   └── icons/
│
├── 📁 tests/                      # Test files
│   └── __tests__/                 # Jest test suites
│
├── 📁 docker-ubuntu-cron/         # Docker cron setup
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── README.md
│
├── 📁 examples/                   # Example code and templates
├── 📁 design-templates/           # Design system templates
├── 📁 PRPs/                       # Project Requirement Proposals
└── 📁 web-ui/                     # Additional UI components
```

## 🚀 Quick Start

### Development Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
# → http://localhost:3000

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Environment Variables
Required variables (see `.env.example`):
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Email Providers
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=

# Application
NEXT_PUBLIC_APP_URL=
```

## 📚 Documentation Hub

### Main Documentation
- [**CLAUDE.md**](CLAUDE.md) - AI assistant instructions and project guidelines
- [**DOCUMENTATION_INDEX.md**](DOCUMENTATION_INDEX.md) - Complete documentation navigation
- [**docs/README.md**](docs/README.md) - Documentation organization guide
- [**supabase/README.md**](supabase/README.md) - Database documentation

### Key Guides
- [Campaign Workflow Guide](docs/documentation/CAMPAIGN_WORKFLOW_GUIDE.md)
- [Contact Management PRD](docs/documentation/PRD-Contact-List-Management.md)
- [Supabase Auth Implementation](docs/documentation/SUPABASE_AUTH_IMPLEMENTATION.md)
- [Email Sending Implementation](docs/documentation/ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md)
- [Cron Setup Instructions](docs/documentation/CRON_SETUP_INSTRUCTIONS.md)

### Technical Documentation
- [Database Schema](supabase/schemas/database-schema.sql)
- [API Routes Documentation](src/app/api/)
- [Component Library](components/)
- [Type Definitions](lib/database.types.ts)

## 🏛️ Architecture Overview

### Technology Stack

**Frontend:**
- Next.js 15.4.6 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3.3
- Radix UI components
- shadcn/ui component library

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Auth + Realtime)
- Node.js 20+

**Email Integration:**
- Gmail API (OAuth2)
- Microsoft Graph API (Outlook OAuth2)
- Nodemailer (SMTP)
- IMAP for inbox sync

**AI Services:**
- OpenAI GPT-4
- Anthropic Claude
- Google Gemini

**Infrastructure:**
- Vercel (hosting)
- Supabase (database + auth)
- Docker (cron jobs)
- Upstash Redis (rate limiting)

### Application Layers

#### 1. **Presentation Layer** (`src/app/`, `components/`)
- Next.js App Router pages
- React Server Components
- Client-side interactive components
- shadcn/ui component system

#### 2. **API Layer** (`src/app/api/`)
- RESTful API routes
- Authentication middleware
- Rate limiting
- Error handling

#### 3. **Business Logic Layer** (`lib/`)
- Campaign management
- Contact management
- Email provider integrations
- AI personalization engine
- Authentication & authorization

#### 4. **Data Layer** (`supabase/`)
- PostgreSQL database
- Supabase Auth
- Real-time subscriptions
- Row Level Security (RLS)

#### 5. **Integration Layer**
- OAuth providers (Gmail, Outlook)
- Email APIs (Gmail, Microsoft Graph, SMTP)
- AI APIs (OpenAI, Anthropic, Google)
- Webhook handlers

## 📋 Core Modules

### Authentication & User Management
**Location:** `lib/auth.ts`, `src/app/(auth)/`

**Features:**
- Email/password authentication
- OAuth providers (Google, Microsoft)
- Plan-based permissions (Starter, Professional, Agency)
- Session management
- User profile management

**Key Files:**
- `lib/supabase-client.ts` - Browser client
- `lib/supabase-server.ts` - Server-side client
- `src/app/api/auth/` - Auth API routes

### Campaign Management
**Location:** `lib/campaigns.ts`, `lib/campaign-execution.ts`, `lib/campaign-processor.ts`

**Features:**
- Multi-step email sequences (up to 7 steps)
- Batch scheduling with 20-minute intervals
- AI personalization integration
- A/B testing capabilities
- Campaign analytics
- Real-time status tracking

**Key Files:**
- `lib/campaigns.ts` - Campaign CRUD operations
- `lib/campaign-execution.ts` - Email sending logic
- `lib/campaign-processor.ts` - Batch processing engine
- `src/app/api/campaigns/` - Campaign API routes

### Contact Management
**Location:** `lib/contacts.ts`, `lib/contact-segmentation.ts`, `lib/contact-engagement.ts`

**Features:**
- Contact import (CSV, manual)
- Custom fields and tags
- Dynamic segmentation
- Engagement scoring
- Email validation
- Contact lists management

**Key Files:**
- `lib/contacts.ts` - Contact CRUD operations
- `lib/contact-segmentation.ts` - Segmentation logic
- `lib/contact-engagement.ts` - Engagement tracking
- `src/app/api/contacts/` - Contact API routes

### Email Provider Integration
**Location:** `lib/email-providers.ts`, `lib/oauth-providers.ts`

**Features:**
- Gmail OAuth2 integration
- Outlook OAuth2 integration
- Custom SMTP support
- Token management & refresh
- Domain authentication (SPF, DKIM, DMARC)
- Email warmup system
- Rate limiting per provider

**Key Files:**
- `lib/email-providers.ts` - Provider implementations
- `lib/oauth-providers.ts` - OAuth flow handling
- `lib/gmail-imap-smtp.ts` - Gmail-specific logic
- `src/app/api/email-accounts/` - Email account API routes

### AI Personalization
**Location:** `lib/ai-personalization.ts`

**Features:**
- Multi-provider support (OpenAI, Anthropic, Google)
- Template-based personalization
- Custom prompt personalization
- Bulk personalization
- Token usage tracking
- Fallback handling

**Key Files:**
- `lib/ai-personalization.ts` - AI integration
- `src/app/api/ai/` - AI API routes

### Inbox Management
**Location:** `lib/inbox-sync.ts`, `lib/autonomous-replies.ts`

**Features:**
- IMAP email synchronization
- Gmail API integration
- Autonomous reply detection
- Email classification
- Thread tracking
- Attachment handling

**Key Files:**
- `lib/inbox-sync.ts` - Inbox synchronization
- `lib/autonomous-replies.ts` - Auto-reply system
- `src/app/api/inbox/` - Inbox API routes

## 🗂️ Database Schema

### Core Tables
- `users` - User accounts and profiles
- `email_accounts` - Connected email accounts
- `contacts` - Contact database
- `contact_lists` - Contact list management
- `campaigns` - Campaign definitions
- `email_sends` - Individual email tracking
- `incoming_emails` - Inbox emails
- `outgoing_emails` - Sent email tracking

### Detailed Schema
See [supabase/schemas/database-schema.sql](supabase/schemas/database-schema.sql) for complete schema.

**Key Relationships:**
```
users (1) → (many) email_accounts
users (1) → (many) contacts
users (1) → (many) campaigns
campaigns (many) ↔ (many) contacts (via campaign_contacts)
email_accounts (1) → (many) email_sends
campaigns (1) → (many) email_sends
```

## 🔌 API Routes

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signup` - Sign up
- `GET /api/auth/callback` - OAuth callback
- `GET /api/auth/session` - Get session

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/[id]` - Get campaign
- `PATCH /api/campaigns/[id]` - Update campaign
- `DELETE /api/campaigns/[id]` - Delete campaign
- `POST /api/campaigns/[id]/start` - Start campaign
- `POST /api/campaigns/[id]/pause` - Pause campaign
- `POST /api/campaigns/[id]/stop` - Stop campaign

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/[id]` - Get contact
- `PATCH /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact
- `POST /api/contacts/import` - Import contacts
- `GET /api/contacts/stats` - Contact statistics
- `POST /api/contacts/recalculate-engagement` - Recalculate engagement scores

### Email Accounts
- `GET /api/email-accounts` - List accounts
- `POST /api/email-accounts` - Add account
- `GET /api/email-accounts/[id]` - Get account
- `PATCH /api/email-accounts/[id]` - Update account
- `DELETE /api/email-accounts/[id]` - Delete account
- `POST /api/email-accounts/[id]/verify` - Verify account
- `GET /api/email-accounts/oauth/gmail` - Gmail OAuth
- `GET /api/email-accounts/oauth/outlook` - Outlook OAuth

### AI Personalization
- `POST /api/ai/personalize` - Single personalization
- `POST /api/ai/bulk-personalize` - Bulk personalization
- `GET /api/ai/templates` - List templates
- `POST /api/ai/templates` - Create template

### Inbox
- `GET /api/inbox/emails` - List inbox emails
- `POST /api/inbox/sync` - Sync inbox
- `GET /api/inbox/emails/[id]` - Get email
- `POST /api/inbox/emails/[id]/reply` - Reply to email

### Cron Jobs
- `GET /api/cron/process-campaigns` - Process campaigns
- `GET /api/cron/sync-inboxes` - Sync all inboxes
- `GET /api/cron/docker-test` - Test Docker cron

## 🧪 Testing

### Test Structure
```
tests/
└── __tests__/
    ├── lib/
    │   ├── campaigns.test.ts
    │   ├── contacts.test.ts
    │   └── email-providers.test.ts
    └── api/
        ├── campaigns.test.ts
        └── contacts.test.ts
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- campaigns.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage Goals
- Unit Tests: ≥80% coverage
- Integration Tests: ≥70% coverage
- API Routes: ≥90% coverage

## 🚦 Development Workflow

### Branch Strategy
- `main` - Production branch
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

### Commit Convention
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Examples:
  feat(campaigns): add batch scheduling
  fix(contacts): resolve engagement calculation
  docs(readme): update installation steps
```

### Code Quality
```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit

# Format code
npx prettier --write .
```

## 🔧 Configuration Files

### Next.js Configuration
**File:** `next.config.js`
- App Router configuration
- Environment variables
- Image optimization
- Webpack customization

### TypeScript Configuration
**File:** `tsconfig.json`
- Path aliases (`@/` for src/)
- Strict mode enabled
- Next.js preset

### Tailwind Configuration
**File:** `tailwind.config.js`
- Custom color palette
- shadcn/ui integration
- Custom animations
- Responsive breakpoints

### ESLint Configuration
**File:** `.eslintrc.json`
- Next.js rules
- TypeScript rules
- Custom project rules

## 📦 Dependencies

### Core Dependencies
- `next` ^15.4.6 - React framework
- `react` ^18.0.0 - UI library
- `typescript` ^5.0.0 - Type safety
- `@supabase/supabase-js` ^2.57.4 - Database client
- `@supabase/ssr` ^0.6.1 - SSR support

### UI Libraries
- `@radix-ui/*` - Headless UI components
- `tailwindcss` ^3.3.0 - Utility CSS
- `lucide-react` ^0.294.0 - Icons
- `framer-motion` ^12.23.12 - Animations

### Email & Communication
- `googleapis` ^154.0.0 - Gmail API
- `@microsoft/microsoft-graph-client` ^3.0.7 - Outlook API
- `nodemailer` ^6.10.1 - Email sending
- `node-imap` ^0.9.6 - IMAP client
- `mailparser` ^3.7.4 - Email parsing

### AI & ML
- `openai` ^4.104.0 - OpenAI API
- `@anthropic-ai/sdk` ^0.57.0 - Anthropic Claude
- `@google/generative-ai` ^0.24.1 - Google Gemini

### Utilities
- `date-fns` ^4.1.0 - Date utilities
- `zod` ^3.25.76 - Schema validation
- `bcryptjs` ^3.0.2 - Password hashing
- `@upstash/redis` ^1.35.1 - Rate limiting

## 🌐 Deployment

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables
Set in Vercel dashboard:
- Supabase credentials
- AI API keys
- Email provider credentials
- Application URL

### Docker Cron Setup
See [docker-ubuntu-cron/README.md](docker-ubuntu-cron/README.md)

```bash
# On Ubuntu server
cd docker-ubuntu-cron
cp .env.example .env
# Edit .env with your settings
docker-compose up -d
```

## 📊 Monitoring & Debugging

### Logging
- API routes log to Vercel logs
- Database operations log to Supabase logs
- Email sending logs to database (`email_sends` table)
- Campaign processing logs to console

### Debug Tools
- `/debug-auth` - Authentication debugging
- Supabase dashboard - Database monitoring
- Vercel dashboard - Application logs
- Browser DevTools - Network and console

### Performance Monitoring
- Vercel Analytics
- Supabase database metrics
- Email delivery rates
- Campaign performance metrics

## 🔐 Security

### Authentication
- Supabase Auth with JWT
- Row Level Security (RLS) on all tables
- Service role for backend operations
- OAuth for email providers

### Data Protection
- Encrypted OAuth tokens
- HTTPS only
- Environment variable secrets
- Rate limiting on API routes

### Best Practices
- Never commit `.env` files
- Use service role key only on backend
- Validate all user inputs
- Sanitize email content
- Implement CSRF protection

## 🆘 Troubleshooting

### Common Issues

**Authentication loops:**
- Check `middleware.ts` configuration
- Verify Supabase environment variables
- See [docs/fixes/AUTHENTICATION_LOOP_FIX_FINAL.md](docs/fixes/AUTHENTICATION_LOOP_FIX_FINAL.md)

**Campaign not starting:**
- Verify email account connection
- Check contact list validity
- Review campaign schedule settings
- See [docs/fixes/CAMPAIGN_STOP_FIX_SUMMARY.md](docs/fixes/CAMPAIGN_STOP_FIX_SUMMARY.md)

**Email sending failures:**
- Verify provider credentials
- Check domain authentication
- Review rate limits
- See [docs/fixes/SENT_EMAILS_FIX_SUMMARY.md](docs/fixes/SENT_EMAILS_FIX_SUMMARY.md)

**Database connection issues:**
- Verify Supabase credentials
- Check network connectivity
- Review RLS policies
- See [docs/fixes/DATABASE_FIXES_SUMMARY.md](docs/fixes/DATABASE_FIXES_SUMMARY.md)

## 🤝 Contributing

### Development Guidelines
1. Read [CLAUDE.md](CLAUDE.md) for project conventions
2. Follow TypeScript best practices
3. Write tests for new features
4. Update documentation
5. Follow commit conventions

### Code Review Checklist
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Documentation updated
- [ ] No console.log in production code
- [ ] Environment variables documented

## 📈 Roadmap

See [docs/documentation/ROADMAP.md](docs/documentation/ROADMAP.md) for detailed roadmap.

**Upcoming Features:**
- Enhanced analytics dashboard
- Advanced A/B testing
- Email template builder
- Webhook integrations
- API for third-party integrations
- Mobile app support

## 📞 Support & Resources

### Documentation
- [Main Documentation](DOCUMENTATION_INDEX.md)
- [Database Documentation](supabase/README.md)
- [API Documentation](src/app/api/)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs)

### Project Versions
- **Current Version:** v0.17.7
- **Next.js:** 15.4.6
- **Node.js:** 20+
- **Database:** PostgreSQL via Supabase

---

**Last Updated:** October 12, 2025
**Maintainer:** Pitchdonkey Development Team
**License:** Private - All Rights Reserved
