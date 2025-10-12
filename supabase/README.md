# Supabase Database Organization

This directory contains all database-related SQL files organized by purpose and lifecycle.

## Directory Structure

### 📁 `/migrations/` (26 files)
**Purpose:** Chronological database migrations and schema changes

**Naming Convention:** `YYYYMMDD_descriptive_name.sql`

**Recent Migrations:**
- `20251011_add_imap_credentials.sql` - IMAP authentication credentials
- `20251003_add_ai_summary_to_incoming_emails.sql` - AI email summaries
- `20251003_add_agent_to_email_accounts.sql` - Agent assignment to accounts
- `20251002_backfill_batch_schedules.sql` - Batch schedule backfill
- `20251002_add_batch_schedule.sql` - Campaign batch scheduling
- `20250930_fix_imap_uid_bigint.sql` - IMAP UID data type fix
- `20250930_create_outgoing_emails.sql` - Outgoing emails table
- `20250831_advanced_tagging_system.sql` - Advanced contact tagging
- `20250831_add_outreach_agents.sql` - Outreach agent system
- `20250829_add_contact_source_field.sql` - Contact source tracking
- `20250829_add_contact_enrichment.sql` - Contact enrichment system
- `20250829_add_bulk_enrichment_jobs.sql` - Bulk enrichment processing
- `20250829_add_address_postcode_fields.sql` - Address and postcode fields
- `20250131_add_gmail_message_id.sql` - Gmail message ID tracking
- `20241211_add_contact_notes_fields.sql` - Contact notes
- `20241210_add_linkedin_fields.sql` - LinkedIn profile integration

**Core Migrations:**
- `database-migration-autonomous-replies.sql` - Autonomous reply system
- `database-migration-batch-scheduling.sql` - Batch scheduling infrastructure
- `database-migration-email-tracking-warmup.sql` - Email warmup tracking
- `database-migration-email-tracking.sql` - Email engagement tracking
- `database-migration-fix-email-account-id.sql` - Email account ID fix
- `database-migration-simple-campaigns.sql` - Simple campaign system
- `database-migration-add-send-settings.sql` - Send configuration settings
- `campaign-contact-tracking-migration.sql` - Campaign contact tracking
- `add-linkedin-fields-migration.sql` - LinkedIn fields
- `add-sex-field-migration.sql` - Gender field

### 🗂️ `/schemas/` (12 files)
**Purpose:** Complete schema definitions and table structures

**Main Schema:**
- `database-schema.sql` - Primary database schema definition

**Feature Schemas:**
- `database-schema-bulk-personalization.sql` - Bulk email personalization
- `database-schema-campaigns.sql` - Campaign management tables
- `database-schema-contact-lists.sql` - Contact list management
- `database-schema-domain-auth.sql` - Domain authentication (SPF/DKIM/DMARC)
- `database-schema-email-tracking.sql` - Email tracking and analytics
- `database-schema-imap.sql` - IMAP email integration
- `database-schema-rate-limiting.sql` - Rate limiting system
- `database-schema-subscription.sql` - User subscription plans

**Supporting Files:**
- `database-indexes-domain-auth.sql` - Database indexes for domain auth
- `ai_templates.sql` - AI template definitions
- `supabase-setup.sql` - Initial Supabase setup

### 🔧 `/fixes/` (21 files)
**Purpose:** Bug fixes, data corrections, and one-time utilities

**Authentication & Campaign Fixes:**
- `fix-campaign-stop-simple.sql` - Campaign stop functionality fix
- `fix-engagement-status.sql` - Engagement status corrections
- `fix-sent-emails-schema.sql` - Sent emails schema fix
- `fix-tracking-schema.sql` - Tracking schema corrections

**Schema Enhancements:**
- `add-contact-engagement-columns.sql` - Contact engagement tracking
- `add-email-verification-columns.sql` - Email verification fields
- `enhance-contact-engagement-schema.sql` - Enhanced engagement tracking
- `create-contact-lists-table.sql` - Contact lists table creation
- `database-click-tracking-setup.sql` - Click tracking setup

**Data Fixes & Utilities:**
- `fix-bounced-simple.sql` - Bounced email handling
- `fix-bounced-contacts.sql` - Bounced contact cleanup
- `check-bounced-contacts.sql` - Bounced contact verification
- `cancel-stuck-enrichment-jobs.sql` - Cancel stuck enrichment jobs
- `diagnostic-auto-reply.sql` - Auto-reply diagnostics
- `check-actual-campaigns-schema.sql` - Campaign schema verification
- `check-campaign-status-constraint.sql` - Campaign status validation

**One-Time Migrations:**
- `apply-bulk-enrichment-migration.sql` - Apply bulk enrichment
- `manual-campaign-migration.sql` - Manual campaign data migration
- `recreate-bulk-enrichment-table.sql` - Recreate enrichment table
- `remove-status-column.sql` - Remove obsolete status column
- `URGENT-CREATE-TABLE.sql` - Emergency table creation

### 📦 `/archive/` (15 files)
**Purpose:** Deprecated scripts and obsolete data fixes

**Coldreach Import Scripts (Deprecated):**
- `analyze-coldreach-names.sql` - Name analysis
- `bulk-swap-coldreach-05102025.sql` - Bulk name swap
- `check-all-coldreach-contacts.sql` - Contact verification
- `check-name-order.sql` - Name order validation
- `correct-swap-coldreach-05102025.sql` - Corrected swap
- `debug-coldreach-source.sql` - Source debugging
- `find-and-swap-by-contact-id.sql` - Contact ID swap
- `find-contact-source.sql` - Source identification
- `fix-alexandra-baldus.sql` - Specific contact fix
- `fix-coldreach-import-names.sql` - Import name fixes
- `simple-swap-coldreach.sql` - Simple name swap
- `swap-all-327-coldreach-contacts.sql` - Bulk swap
- `swap-all-coldreach-names.sql` - All names swap
- `swap-names-by-contact-id.sql` - Swap by ID
- `swap-names-by-source.sql` - Swap by source
- `verify-all-coldreach-after-swap.sql` - Post-swap verification

## File Organization Guidelines

### When to Add Files

**Add to `/migrations/`:**
- Schema changes (new tables, columns, constraints)
- Structural database modifications
- Feature infrastructure setup
- Use timestamp naming: `YYYYMMDD_description.sql`
- Must be idempotent and reversible when possible

**Add to `/schemas/`:**
- Complete table definitions
- Index and constraint definitions
- View and function definitions
- Feature-specific schema documentation

**Add to `/fixes/`:**
- Bug fix SQL scripts
- Data correction scripts
- One-time utility scripts
- Diagnostic queries
- Schema patches

**Move to `/archive/`:**
- Obsolete migration scripts
- Deprecated data fixes
- One-time scripts that have been executed
- Scripts related to removed features

### Migration Best Practices

1. **Naming Convention:**
   ```
   YYYYMMDD_action_description.sql

   Examples:
   20251012_add_email_templates.sql
   20251012_fix_contact_duplicates.sql
   20251012_create_webhook_logs.sql
   ```

2. **Migration Structure:**
   ```sql
   -- Migration: Description of changes
   -- Created: YYYY-MM-DD
   -- Author: Name
   -- Purpose: Why this migration is needed

   -- Check if already applied (idempotency)
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='table_name' AND column_name='new_column')
     THEN
       ALTER TABLE table_name ADD COLUMN new_column TEXT;
     END IF;
   END $$;
   ```

3. **Testing:**
   - Test on local Supabase instance first
   - Verify data integrity after migration
   - Document rollback steps if needed
   - Keep migrations small and focused

4. **Dependencies:**
   - Document prerequisite migrations
   - Note any required seed data
   - List affected tables and views

### Schema Best Practices

1. **Documentation:**
   - Include table purpose and relationships
   - Document column meanings and constraints
   - Note any special indexes or triggers

2. **Structure:**
   ```sql
   -- Table: table_name
   -- Purpose: Description of table's role
   -- Relationships:
   --   - foreign_key → referenced_table

   CREATE TABLE IF NOT EXISTS table_name (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
     -- ... columns with inline comments
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Indexes
   CREATE INDEX IF NOT EXISTS idx_table_user ON table_name(user_id);

   -- RLS Policies
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   ```

3. **RLS (Row Level Security):**
   - Always enable RLS on user data tables
   - Document policy logic and permissions
   - Test policies with different user roles

### Fix Script Guidelines

1. **Safety First:**
   - Always use transactions
   - Include rollback steps
   - Add verification queries
   - Test on copy of production data

2. **Documentation:**
   ```sql
   -- Fix: Brief description
   -- Issue: GitHub issue or ticket number
   -- Date: YYYY-MM-DD
   -- Impact: Number of affected rows/tables

   BEGIN;

   -- Verification query before fix
   SELECT COUNT(*) FROM table WHERE condition;

   -- Apply fix
   UPDATE table SET column = value WHERE condition;

   -- Verification query after fix
   SELECT COUNT(*) FROM table WHERE condition;

   COMMIT;
   -- ROLLBACK; -- Uncomment if issues found
   ```

## Current Database Version

**Latest Migration:** `20251011_add_imap_credentials.sql`
**Schema Version:** v0.17.7
**Last Organized:** October 12, 2025

## Quick Reference Commands

### Apply Migration
```bash
# Using Supabase CLI
supabase db push

# Or execute specific migration
psql -h <host> -U <user> -d <database> -f supabase/migrations/YYYYMMDD_migration_name.sql
```

### Verify Schema
```bash
# List all tables
psql -h <host> -U <user> -d <database> -c "\dt"

# Describe specific table
psql -h <host> -U <user> -d <database> -c "\d table_name"
```

### Run Fix Script
```bash
# Execute fix with transaction
psql -h <host> -U <user> -d <database> -f supabase/fixes/fix_script.sql
```

## Migration Checklist

Before applying migrations:
- [ ] Test migration on local/staging environment
- [ ] Review migration for potential data loss
- [ ] Document rollback procedure
- [ ] Verify RLS policies if adding user data tables
- [ ] Check for index requirements
- [ ] Update application code if schema changes affect it
- [ ] Backup production data
- [ ] Schedule maintenance window if needed
- [ ] Monitor application after deployment

## Troubleshooting

### Common Issues

**Migration fails with constraint violation:**
- Check existing data compatibility
- Add data migration step before constraint
- Use `IF NOT EXISTS` clauses

**Performance issues after migration:**
- Add appropriate indexes
- Analyze query plans
- Consider batching large updates

**RLS policy blocks access:**
- Verify user context in policies
- Check policy logic with test queries
- Review service role vs anon key usage

## Schema Documentation

For detailed schema information, see:
- [`schemas/database-schema.sql`](schemas/database-schema.sql) - Main schema
- [`/CLAUDE.md`](../CLAUDE.md) - Database conventions section
- Project documentation at [`/docs/documentation/`](../docs/documentation/)

## Statistics

- **Total SQL Files:** 74
- **Active Migrations:** 26
- **Schema Definitions:** 12
- **Fix Scripts:** 21
- **Archived Scripts:** 15

---

**Maintenance Schedule:**

**After each feature:**
1. Document new migrations with clear naming
2. Update schema files if major changes
3. Archive executed one-time scripts

**Monthly:**
1. Review `/fixes/` for scripts that can be archived
2. Consolidate related migrations if needed
3. Update this README with new patterns

**Quarterly:**
1. Clean `/archive/` of very old scripts
2. Review and optimize database indexes
3. Audit RLS policies for security
