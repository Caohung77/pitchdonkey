-- Migration: Add Email Tracking and Warmup Integration
-- This migration adds email tracking counters and warmup progression columns

-- ============================================================================
-- PART 1: Email Tracking Columns
-- ============================================================================

-- Add lifetime email counter to email_accounts
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0;

-- Add warmup tracking columns to email_accounts
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS warmup_plan_id UUID;

ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS warmup_current_week INTEGER DEFAULT 1;

ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS warmup_current_daily_limit INTEGER DEFAULT 5;

-- Add foreign key constraint for warmup_plan_id
ALTER TABLE email_accounts
ADD CONSTRAINT fk_email_accounts_warmup_plan
FOREIGN KEY (warmup_plan_id)
REFERENCES warmup_plans(id)
ON DELETE SET NULL;

-- ============================================================================
-- PART 2: Indexes for Performance
-- ============================================================================

-- Index for quickly finding accounts that need daily reset
CREATE INDEX IF NOT EXISTS idx_email_accounts_current_daily_sent
ON email_accounts(current_daily_sent)
WHERE current_daily_sent > 0;

-- Index for warmup-enabled accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_warmup_enabled
ON email_accounts(warmup_enabled)
WHERE warmup_enabled = true;

-- Index for finding accounts by warmup plan
CREATE INDEX IF NOT EXISTS idx_email_accounts_warmup_plan_id
ON email_accounts(warmup_plan_id)
WHERE warmup_plan_id IS NOT NULL;

-- ============================================================================
-- PART 3: Daily Reset Function
-- ============================================================================

-- Function to reset daily email counters at midnight
CREATE OR REPLACE FUNCTION reset_daily_email_counters()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset current_daily_sent to 0 for all accounts that sent emails today
  UPDATE email_accounts
  SET current_daily_sent = 0
  WHERE current_daily_sent > 0;

  GET DIAGNOSTICS reset_count = ROW_COUNT;

  -- Also reset warmup_plans.actual_sent_today for active warmup plans
  UPDATE warmup_plans
  SET actual_sent_today = 0
  WHERE status = 'active' AND actual_sent_today > 0;

  -- Log the reset operation
  RAISE NOTICE 'Daily email counters reset: % email accounts updated', reset_count;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: Schedule Daily Reset (requires pg_cron extension)
-- ============================================================================

-- Note: pg_cron must be enabled first with: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Uncomment the following lines after enabling pg_cron:

-- SELECT cron.schedule(
--   'reset-daily-email-counters',
--   '0 0 * * *',  -- Every day at midnight UTC
--   'SELECT reset_daily_email_counters();'
-- );

-- ============================================================================
-- PART 5: Initialize Existing Data
-- ============================================================================

-- Set default values for existing email accounts
UPDATE email_accounts
SET
  total_emails_sent = COALESCE(total_emails_sent, 0),
  current_daily_sent = COALESCE(current_daily_sent, 0),
  warmup_current_week = COALESCE(warmup_current_week, 1),
  warmup_current_daily_limit = COALESCE(warmup_current_daily_limit, 5)
WHERE total_emails_sent IS NULL
   OR current_daily_sent IS NULL
   OR warmup_current_week IS NULL
   OR warmup_current_daily_limit IS NULL;

-- Link existing warmup plans to email accounts
UPDATE email_accounts ea
SET warmup_plan_id = wp.id
FROM warmup_plans wp
WHERE ea.id = wp.email_account_id
  AND wp.status IN ('active', 'pending')
  AND ea.warmup_enabled = true
  AND ea.warmup_plan_id IS NULL;

-- ============================================================================
-- PART 6: Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN email_accounts.total_emails_sent IS
'Lifetime total emails sent through this account (never resets, used for warmup milestones)';

COMMENT ON COLUMN email_accounts.current_daily_sent IS
'Number of emails sent today (resets daily at midnight UTC)';

COMMENT ON COLUMN email_accounts.warmup_plan_id IS
'Reference to active warmup plan for this email account';

COMMENT ON COLUMN email_accounts.warmup_current_week IS
'Current week in warmup progression (1-6 for conservative, 1-4 for moderate, 1-3 for aggressive)';

COMMENT ON COLUMN email_accounts.warmup_current_daily_limit IS
'Current daily send limit enforced by warmup (increases as warmup progresses)';

COMMENT ON FUNCTION reset_daily_email_counters() IS
'Resets daily email counters for all accounts. Should run daily at midnight UTC via pg_cron.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'email_accounts'
  AND column_name IN (
    'total_emails_sent',
    'current_daily_sent',
    'warmup_plan_id',
    'warmup_current_week',
    'warmup_current_daily_limit'
  )
ORDER BY ordinal_position;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'email_accounts'
  AND indexname LIKE 'idx_email_accounts_%'
ORDER BY indexname;

-- Verify function was created
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'reset_daily_email_counters';