# Pitchdonkey Documentation Index

> **Version:** v0.17.7
> **Last Updated:** October 12, 2025

Welcome to the Pitchdonkey documentation. All documentation has been organized into clear categories for easy navigation.

## 📂 Documentation Structure

```
docs/
├── documentation/    # Current guides, setups, and workflows (29 files)
├── fixes/           # Bug fixes and implementation summaries (22 files)
├── archive/         # Outdated and deprecated docs (10 files)
└── README.md        # Detailed organization guide
```

## 🚀 Quick Start

| I Want To... | Go Here |
|--------------|---------|
| **Set up the project** | [`docs/documentation/SUPABASE_AUTH_IMPLEMENTATION.md`](docs/documentation/SUPABASE_AUTH_IMPLEMENTATION.md) |
| **Understand product vision** | [`docs/documentation/prd.md`](docs/documentation/prd.md) |
| **Create a campaign** | [`docs/documentation/CAMPAIGN_WORKFLOW_GUIDE.md`](docs/documentation/CAMPAIGN_WORKFLOW_GUIDE.md) |
| **Set up cron jobs** | [`docs/documentation/CRON_SETUP_INSTRUCTIONS.md`](docs/documentation/CRON_SETUP_INSTRUCTIONS.md) |
| **Configure email sending** | [`docs/documentation/ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md`](docs/documentation/ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md) |
| **Troubleshoot an issue** | [`docs/fixes/`](docs/fixes/) |
| **See what's changed** | [`docs/documentation/CHANGELOG.md`](docs/documentation/CHANGELOG.md) |
| **Learn about AI agents** | [`docs/documentation/AGENTS.md`](docs/documentation/AGENTS.md) |

## 📚 Key Documentation

### Core Guides
- [**Changelog**](docs/documentation/CHANGELOG.md) - Version history (currently v0.17.7)
- [**Roadmap**](docs/documentation/ROADMAP.md) - Future development plans
- [**Product Requirements**](docs/documentation/prd.md) - Complete product specification
- [**Contact Management PRD**](docs/documentation/PRD-Contact-List-Management.md) - Contact list features

### Workflow Guides
- [**Campaign Workflow**](docs/documentation/CAMPAIGN_WORKFLOW_GUIDE.md) - Creating and managing campaigns
- [**Campaign Scheduling**](docs/documentation/CAMPAIGN_SCHEDULING_WORKFLOW.md) - Scheduling system details
- [**Segment Testing**](docs/documentation/SEGMENT_TESTING_GUIDE.md) - Testing contact segments
- [**Batch Scheduling**](docs/documentation/batch-scheduling-test-guide.md) - Batch processing guide

### Setup & Configuration
- [**Supabase Auth**](docs/documentation/SUPABASE_AUTH_IMPLEMENTATION.md) - Authentication setup
- [**Email Sending**](docs/documentation/ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md) - Email provider configuration
- [**IMAP Setup**](docs/documentation/IMAP-SETUP.md) - IMAP integration
- [**SMTP Sent Sync**](docs/documentation/SMTP_SENT_FOLDER_SYNC_IMPLEMENTATION.md) - SMTP folder synchronization
- [**Cron Jobs**](docs/documentation/CRON_JOBS.md) - Active cron job reference
- [**Ubuntu Cron Setup**](docs/documentation/CRON_SETUP_UBUNTU.md) - Ubuntu-specific configuration
- [**Database Migration**](docs/documentation/MANUAL_DATABASE_MIGRATION.md) - Manual migration procedures

### Advanced Features
- [**AI Agents**](docs/documentation/AGENTS.md) - AI agent system documentation
- [**Outreach Agents**](docs/documentation/OUTREACH_AGENTS.md) - Automated outreach system
- [**Autonomous Replies**](docs/documentation/AUTONOMOUS_REPLY_SYSTEM_COMPLETE.md) - Auto-reply implementation
- [**Bulk Batching**](docs/documentation/Bulk-Campaign-Batching-System.md) - Campaign batch processing
- [**Gmail Integration**](docs/documentation/MAILBOX_GMAIL_INTEGRATION.md) - Gmail mailbox features
- [**Enrichment Progress**](docs/documentation/enrichment-progress-bar.md) - Contact enrichment UI

## 🔧 Recent Fixes

Latest bug fixes and improvements (see [`docs/fixes/`](docs/fixes/) for all):

- [Email Sync Complete Fix v0.21.0](docs/fixes/EMAIL_SYNC_COMPLETE_FIX_v0.21.0.md)
- [Gmail Inbox Fix Report](docs/fixes/GMAIL_INBOX_FIX_REPORT.md)
- [Authentication Loop Fix](docs/fixes/AUTHENTICATION_LOOP_FIX_FINAL.md)
- [Campaign Stop Fix](docs/fixes/CAMPAIGN_STOP_FIX_SUMMARY.md)
- [Click Tracking Implementation](docs/fixes/CLICK_TRACKING_IMPLEMENTATION_SUMMARY.md)

## 🏗️ For Developers

### For Claude Code AI Assistant
See [`CLAUDE.md`](CLAUDE.md) in the project root for AI assistant instructions.

### Project Structure
```
pitchdonkey/
├── CLAUDE.md                    # Claude Code instructions
├── DOCUMENTATION_INDEX.md       # This file
├── docs/                        # All documentation
│   ├── README.md               # Detailed organization guide
│   ├── documentation/          # Current docs (29 files)
│   ├── fixes/                  # Bug fixes (22 files)
│   └── archive/                # Deprecated docs (10 files)
├── docker-ubuntu-cron/         # Docker cron setup
├── src/                        # Application source code
├── lib/                        # Shared libraries
└── package.json                # Dependencies
```

## 📋 Documentation Guidelines

### Adding New Documentation

**Current Features → `docs/documentation/`**
- Feature guides and tutorials
- Setup and configuration instructions
- System architecture documentation

**Bug Fixes → `docs/fixes/`**
- Fix summaries and implementation details
- Migration guides for fixes
- Post-mortem analyses

**Deprecated → `docs/archive/`**
- Removed features
- Superseded implementations
- Old debugging notes

### Naming Conventions
- `*_GUIDE.md` - Step-by-step tutorials
- `*_IMPLEMENTATION.md` - Technical implementations
- `*_FIX*.md` - Bug fixes and corrections
- `*_SETUP.md` - Configuration guides
- `PRD-*.md` - Product requirements

## 📞 Getting Help

1. **Check Documentation**: Start with this index
2. **Search Fixes**: Look in `docs/fixes/` for known issues
3. **Review Changelog**: See `docs/documentation/CHANGELOG.md` for recent changes
4. **Archive**: Check `docs/archive/` for historical context

## 📊 Documentation Stats

- **Total Documentation Files**: 61
- **Current Documentation**: 29 files
- **Fix Summaries**: 22 files
- **Archived Documents**: 10 files
- **Current Version**: v0.17.7
- **Last Reorganization**: October 12, 2025

---

**Next Steps:**
- Browse [`docs/README.md`](docs/README.md) for detailed organization
- Review [`docs/documentation/CHANGELOG.md`](docs/documentation/CHANGELOG.md) for recent changes
- Explore [`docs/documentation/ROADMAP.md`](docs/documentation/ROADMAP.md) for future plans
