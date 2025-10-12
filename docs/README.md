# Documentation Organization

This directory contains all project documentation organized by category.

## Directory Structure

### 📚 `/documentation/` (29 files)
Current and active documentation for the project (v0.17.7+):

**Core Documentation:**
- `CHANGELOG.md` - Version history and release notes
- `ROADMAP.md` - Project roadmap and future plans
- `AGENTS.md` - AI agents documentation
- `outreach agent.md` - Outreach agent specifications

**Product Requirements:**
- `prd.md` - Main product requirements document
- `PRD-Contact-List-Management.md` - Contact list management specifications

**Workflow Guides:**
- `CAMPAIGN_WORKFLOW_GUIDE.md` - Campaign creation and management
- `CAMPAIGN_SCHEDULING_WORKFLOW.md` - Campaign scheduling process
- `SCHEDULED_CAMPAIGNS_GUIDE.md` - Scheduled campaigns usage
- `SEGMENT_TESTING_GUIDE.md` - Contact segmentation testing
- `batch-scheduling-test-guide.md` - Batch scheduling testing

**Setup & Implementation:**
- `ACTUAL_EMAIL_SENDING_IMPLEMENTATION.md` - Email sending implementation
- `SUPABASE_AUTH_IMPLEMENTATION.md` - Supabase authentication setup
- `SMTP_SENT_FOLDER_SYNC_IMPLEMENTATION.md` - SMTP sent folder synchronization
- `IMAP-SETUP.md` - IMAP configuration guide
- `MANUAL_DATABASE_MIGRATION.md` - Database migration procedures

**Cron & Automation:**
- `CRON_JOBS.md` - Active cron job documentation
- `CRON_EMAIL_SYNC_SETUP.md` - Email sync cron setup
- `CRON_SETUP_INSTRUCTIONS.md` - General cron setup
- `CRON_SETUP_UBUNTU.md` - Ubuntu-specific cron configuration
- `QUICK_START_SMTP_SENT_SYNC.md` - Quick start for SMTP sync

**Feature Documentation:**
- `AUTONOMOUS_REPLY_SYSTEM_COMPLETE.md` - Autonomous reply system
- `AUTONOMOUS_REPLY_VERIFICATION.md` - Reply system verification
- `BULK_ENRICHMENT_SETUP.md` - Bulk enrichment configuration
- `Bulk-Campaign-Batching-System.md` - Campaign batching system
- `MAILBOX_GMAIL_INTEGRATION.md` - Gmail integration
- `OUTREACH_AGENTS.md` - Outreach agents system
- `PHASE_5_LEARNING_OPTIMIZATION.md` - ML optimization phase
- `enrichment-progress-bar.md` - Enrichment progress UI

### 🔧 `/fixes/` (22 files)
Bug fixes, improvements, and implementation summaries:

**Authentication Fixes:**
- `AUTHENTICATION_FIX_SUMMARY.md`
- `AUTHENTICATION_FIXES_SUMMARY.md`
- `AUTHENTICATION_LOOP_FIX_FINAL.md`

**Campaign Fixes:**
- `CAMPAIGN_STOP_FIX_SUMMARY.md`
- `SIMPLE_CAMPAIGN_FIXES_SUMMARY.md`
- `SIMPLE_CAMPAIGN_JAVASCRIPT_ERROR_FIX.md`
- `GMAIL_CAMPAIGN_FIXES.md`

**Email & Tracking Fixes:**
- `CLICK_TRACKING_FIX_SUMMARY.md`
- `CLICK_TRACKING_IMPLEMENTATION_SUMMARY.md`
- `SENT_EMAILS_BUG_FIX.md`
- `SENT_EMAILS_FIX_SUMMARY.md`
- `SENT_MAILBOX_FIX_ANALYSIS.md`
- `SMTP_SENT_EMAILS_FIX.md`
- `EMAIL_SYNC_COMPLETE_FIX_v0.21.0.md`
- `GMAIL_INBOX_FIX_REPORT.md`

**Database & Data Fixes:**
- `DATABASE_FIXES_SUMMARY.md`
- `CONSTRAINT_FIX.md`
- `CONTACT_LIST_BUG_FIX_SUMMARY.md`
- `ENRICHMENT_FIX_SUMMARY.md`
- `ENRICHMENT_FIX_REPORT.md`

**Other Fixes:**
- `FIX_AUTO_REPLY_TIMEOUT.md`
- `IMPLEMENTATION_COMPLETE_SUMMARY.md`

### 📦 `/archive/` (10 files)
Outdated documentation from previous versions and deprecated features:

**Initial Implementations:**
- `INITIAL.md` - Original project setup
- `INITIAL_EXAMPLE.md` - Initial examples
- `INITIAL_EMAIL_ACCOUNTS.md` - Original email account setup

**Deprecated Diagnostics:**
- `ENRICHMENT_DIAGNOSIS.md` - Old enrichment diagnostics
- `SEGMENT_CREATION_DEBUG.md` - Legacy segment debugging
- `AUTO_REPLY_SYSTEM_ANALYSIS.md` - Old auto-reply analysis

**Old Testing & Status:**
- `linkedin-scraper-test-results.md` - LinkedIn scraper testing
- `LINKEDIN-SCRAPER-FIXED.md` - LinkedIn scraper fix (deprecated)
- `SYSTEM_STATUS_SUMMARY.md` - Old system status
- `QUICK_FIX_REFERENCE.md` - Legacy quick fixes

## Root Directory Files

**Keep in Root:**
- `/CLAUDE.md` - Claude Code assistant instructions (must remain in root)

## Organization Guidelines

### When Adding New Documentation:

**Add to `/documentation/`:**
- New features and capabilities
- Workflow guides and tutorials
- Setup and configuration guides
- Current system architecture

**Add to `/fixes/`:**
- Bug fix summaries
- Implementation improvements
- Migration guides for fixes
- Post-mortem analyses

**Move to `/archive/`:**
- Documentation for removed features
- Superseded implementation guides
- Old debugging notes
- Deprecated workflows

### Maintenance Schedule:

**After each major version release:**
1. Review `/fixes/` - Move resolved issues to archive if no longer relevant
2. Update `/documentation/` - Ensure guides reflect current version
3. Clean `/archive/` - Remove files older than 3 versions

**Current Version:** v0.17.7
**Last Organized:** October 12, 2025

## Quick Reference

| Need | Look Here |
|------|-----------|
| How to implement a feature | `/documentation/` |
| Troubleshoot a known issue | `/fixes/` |
| Historical context | `/archive/` |
| Claude Code instructions | Root `CLAUDE.md` |

## File Naming Conventions

- `*_GUIDE.md` - Step-by-step tutorials
- `*_IMPLEMENTATION.md` - Technical implementations
- `*_FIX*.md` - Bug fixes and corrections
- `*_SETUP.md` - Configuration and setup
- `PRD-*.md` - Product requirement documents
- `INITIAL_*.md` - Original implementations (usually archived)
