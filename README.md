# Pitchdonkey

> **Cold Email Outreach Platform with AI Personalization**
>
> Version: v0.17.7 | Framework: Next.js 15.4.6 | Database: Supabase

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
# → http://localhost:3000
```

## 📚 Documentation

- **[PROJECT_INDEX.md](PROJECT_INDEX.md)** - Complete project reference and architecture
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Documentation navigation hub
- **[CLAUDE.md](CLAUDE.md)** - AI assistant instructions and guidelines
- **[docs/](docs/)** - Detailed documentation, guides, and fixes
- **[supabase/](supabase/)** - Database schemas, migrations, and SQL scripts

## 🏗️ Project Structure

```
pitchdonkey/
├── src/app/              # Next.js App Router pages & API routes
├── components/           # Shared React components
├── lib/                  # Core business logic
├── hooks/                # React custom hooks
├── supabase/             # Database (migrations, schemas, fixes)
├── docs/                 # Documentation (guides, fixes, archive)
├── scripts/              # Utility scripts
├── public/               # Static assets
└── tests/                # Test files
```

## 🎯 Core Features

- 📧 **Multi-Provider Email** - Gmail, Outlook, Custom SMTP
- 🤖 **AI Personalization** - OpenAI, Anthropic, Google Gemini
- 📊 **Campaign Management** - Batch scheduling, A/B testing, analytics
- 👥 **Contact Management** - Lists, segmentation, engagement tracking
- 📬 **Inbox Management** - IMAP sync, autonomous replies
- 🎯 **Domain Auth** - SPF, DKIM, DMARC validation
- 📈 **Real-time Analytics** - Campaign performance, engagement metrics

## 🛠️ Tech Stack

**Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS, Radix UI
**Backend:** Next.js API Routes, Supabase (PostgreSQL + Auth)
**Email:** Gmail API, Microsoft Graph, Nodemailer (SMTP), IMAP
**AI:** OpenAI GPT-4, Anthropic Claude, Google Gemini
**Infrastructure:** Vercel, Supabase, Docker (cron), Upstash Redis

## 📋 Available Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint
npm test              # Run tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## 🌐 Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key

# Email Providers
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🗺️ Key Documentation

### Getting Started
- [Campaign Workflow Guide](docs/documentation/CAMPAIGN_WORKFLOW_GUIDE.md)
- [Contact Management PRD](docs/documentation/PRD-Contact-List-Management.md)
- [Supabase Auth Setup](docs/documentation/SUPABASE_AUTH_IMPLEMENTATION.md)
- [Email Sending Implementation](docs/documentation/ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md)

### Database
- [Database README](supabase/README.md)
- [Main Schema](supabase/schemas/database-schema.sql)
- [Migrations](supabase/migrations/)
- [Fix Scripts](supabase/fixes/)

### Deployment
- [Cron Setup Instructions](docs/documentation/CRON_SETUP_INSTRUCTIONS.md)
- [Docker Cron Setup](docker-ubuntu-cron/README.md)
- [Ubuntu Cron Configuration](docs/documentation/CRON_SETUP_UBUNTU.md)

## 📊 Database

**26 Migrations** | **12 Schema Definitions** | **21 Fix Scripts**

Core tables: `users`, `email_accounts`, `contacts`, `contact_lists`, `campaigns`, `email_sends`, `incoming_emails`, `outgoing_emails`

See [supabase/README.md](supabase/README.md) for detailed database documentation.

## 🔌 API Routes

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signup` - Sign up
- `GET /api/auth/callback` - OAuth callback

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/[id]/start` - Start campaign

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `POST /api/contacts/import` - Import contacts

### Email Accounts
- `GET /api/email-accounts` - List accounts
- `POST /api/email-accounts` - Add account
- `GET /api/email-accounts/oauth/gmail` - Gmail OAuth

See [PROJECT_INDEX.md](PROJECT_INDEX.md) for complete API documentation.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- campaigns.test.ts

# Run with coverage
npm run test:coverage
```

**Coverage Goals:** Unit: ≥80% | Integration: ≥70% | API: ≥90%

## 🚦 Development Workflow

### Branch Strategy
- `main` - Production
- `develop` - Development
- `feature/*` - Features
- `fix/*` - Bug fixes

### Commit Convention
```
type(scope): description

Examples:
  feat(campaigns): add batch scheduling
  fix(contacts): resolve engagement calculation
  docs(readme): update installation steps
```

## 🔐 Security

- Supabase Auth with JWT
- Row Level Security (RLS) on all tables
- Encrypted OAuth tokens
- HTTPS only
- Rate limiting on API routes
- Environment variable secrets

## 🆘 Troubleshooting

### Common Issues

**Authentication loops:**
→ See [docs/fixes/AUTHENTICATION_LOOP_FIX_FINAL.md](docs/fixes/AUTHENTICATION_LOOP_FIX_FINAL.md)

**Campaign not starting:**
→ See [docs/fixes/CAMPAIGN_STOP_FIX_SUMMARY.md](docs/fixes/CAMPAIGN_STOP_FIX_SUMMARY.md)

**Email sending failures:**
→ See [docs/fixes/SENT_EMAILS_FIX_SUMMARY.md](docs/fixes/SENT_EMAILS_FIX_SUMMARY.md)

**Database connection issues:**
→ See [docs/fixes/DATABASE_FIXES_SUMMARY.md](docs/fixes/DATABASE_FIXES_SUMMARY.md)

For more troubleshooting, see [docs/fixes/](docs/fixes/)

## 📈 Recent Changes

**v0.17.7** (Current)
- Gmail API inbox sync fixes
- Multi-user email support
- Enhanced batch scheduling
- IMAP credentials management
- Auto-reply system improvements

See [docs/documentation/CHANGELOG.md](docs/documentation/CHANGELOG.md) for complete history.

## 📞 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs)

## 📂 Project Organization

**Documentation:** All .md files organized in `docs/` folder
- `docs/documentation/` - Current guides (29 files)
- `docs/fixes/` - Bug fixes (22 files)
- `docs/archive/` - Deprecated (10 files)

**Database:** All .sql files organized in `supabase/` folder
- `supabase/migrations/` - Migrations (26 files)
- `supabase/schemas/` - Schema definitions (12 files)
- `supabase/fixes/` - Fix scripts (21 files)
- `supabase/archive/` - Deprecated (16 files)

## 🤝 Contributing

1. Read [CLAUDE.md](CLAUDE.md) for conventions
2. Follow TypeScript best practices
3. Write tests for new features
4. Update documentation
5. Follow commit conventions

## 📋 Checklist for New Features

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Documentation updated
- [ ] Database migrations created (if needed)
- [ ] Environment variables documented

## 🎯 Roadmap

**Upcoming Features:**
- Enhanced analytics dashboard
- Advanced A/B testing
- Email template builder
- Webhook integrations
- API for third-party integrations

See [docs/documentation/ROADMAP.md](docs/documentation/ROADMAP.md) for details.

---

**For comprehensive documentation, see [PROJECT_INDEX.md](PROJECT_INDEX.md)**

**Version:** v0.17.7 | **Last Updated:** October 12, 2025
