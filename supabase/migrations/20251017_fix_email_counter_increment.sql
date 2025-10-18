-- Fix email counter increment issue
-- Creates a PostgreSQL function to atomically increment email counters
-- This replaces the broken supabase.raw() implementation in campaign-processor.ts

-- Drop function if it exists (for rerunning migration)
DROP FUNCTION IF EXISTS increment_email_counters(UUID);

-- Create function to atomically increment email counters
CREATE OR REPLACE FUNCTION increment_email_counters(account_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_accounts
  SET
    current_daily_sent = COALESCE(current_daily_sent, 0) + 1,
    total_emails_sent = COALESCE(total_emails_sent, 0) + 1,
    updated_at = NOW()
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_email_counters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_email_counters(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION increment_email_counters IS 'Atomically increments current_daily_sent and total_emails_sent counters for an email account. Used by campaign processor when sending emails.';

-- ============================================================================
-- Contact engagement counter increment function
-- ============================================================================

DROP FUNCTION IF EXISTS increment_contact_sent_count(UUID);

CREATE OR REPLACE FUNCTION increment_contact_sent_count(p_contact_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE contacts
  SET
    engagement_sent_count = COALESCE(engagement_sent_count, 0) + 1,
    engagement_status = 'pending',
    updated_at = NOW()
  WHERE id = p_contact_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_contact_sent_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_contact_sent_count(UUID) TO service_role;

COMMENT ON FUNCTION increment_contact_sent_count IS 'Atomically increments engagement_sent_count and sets status to pending for a contact. Used after sending an email to a contact.';

-- ============================================================================
-- Warmup plan counter increment function
-- ============================================================================

DROP FUNCTION IF EXISTS increment_warmup_counters(UUID);

CREATE OR REPLACE FUNCTION increment_warmup_counters(p_warmup_plan_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE warmup_plans
  SET
    actual_sent_today = COALESCE(actual_sent_today, 0) + 1,
    total_sent = COALESCE(total_sent, 0) + 1,
    updated_at = NOW()
  WHERE id = p_warmup_plan_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_warmup_counters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_warmup_counters(UUID) TO service_role;

COMMENT ON FUNCTION increment_warmup_counters IS 'Atomically increments actual_sent_today and total_sent counters for a warmup plan. Used by campaign processor when sending warmup emails.';
