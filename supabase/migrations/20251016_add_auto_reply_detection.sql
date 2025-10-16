-- Migration: Add Auto-Reply Detection Support
-- Description: Adds auto_reply_until field to contacts table to track OOO/vacation auto-replies
-- Version: 1.0
-- Date: 2025-10-16

-- Add auto_reply_until column to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS auto_reply_until timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN contacts.auto_reply_until IS 'Timestamp until which contact has an active auto-reply/OOO message. NULL means no active auto-reply.';

-- Create index for efficient queries on active auto-replies
-- Partial index only includes rows where auto_reply_until is NOT NULL
CREATE INDEX IF NOT EXISTS idx_contacts_auto_reply_until
ON contacts(auto_reply_until)
WHERE auto_reply_until IS NOT NULL;

-- Create compound index for checking contact auto-reply status
-- This will speed up queries that check if a specific contact is auto-replying
CREATE INDEX IF NOT EXISTS idx_contacts_id_auto_reply
ON contacts(id, auto_reply_until);

-- Helper function to check if a contact is currently auto-replying
CREATE OR REPLACE FUNCTION is_contact_auto_replying(contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM contacts
    WHERE id = contact_id
      AND auto_reply_until IS NOT NULL
      AND auto_reply_until > NOW()
  );
$$;

-- Add comment for helper function
COMMENT ON FUNCTION is_contact_auto_replying(uuid) IS 'Returns true if contact has an active auto-reply (auto_reply_until is in the future)';

-- Create view for contacts with computed auto-reply status
CREATE OR REPLACE VIEW contacts_with_ooo_status AS
SELECT
  c.*,
  CASE
    WHEN c.auto_reply_until IS NOT NULL AND c.auto_reply_until > NOW()
    THEN true
    ELSE false
  END AS is_auto_replying,
  CASE
    WHEN c.auto_reply_until IS NOT NULL AND c.auto_reply_until > NOW()
    THEN EXTRACT(EPOCH FROM (c.auto_reply_until - NOW())) / 3600
    ELSE NULL
  END AS hours_until_return
FROM contacts c;

-- Add comment
COMMENT ON VIEW contacts_with_ooo_status IS 'Contacts with computed is_auto_replying flag that auto-updates based on auto_reply_until timestamp';

-- Create view for monitoring active auto-replies
CREATE OR REPLACE VIEW active_auto_replies AS
SELECT
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.auto_reply_until,
  c.tags,
  c.updated_at,
  EXTRACT(EPOCH FROM (c.auto_reply_until - NOW())) / 3600 AS hours_remaining
FROM contacts c
WHERE c.auto_reply_until IS NOT NULL
  AND c.auto_reply_until > NOW()
ORDER BY c.auto_reply_until ASC;

-- Add comment for view
COMMENT ON VIEW active_auto_replies IS 'Lists all contacts with currently active auto-replies, showing remaining time';

-- Grant appropriate permissions
GRANT SELECT ON contacts_with_ooo_status TO authenticated;
GRANT SELECT ON active_auto_replies TO authenticated;
GRANT EXECUTE ON FUNCTION is_contact_auto_replying(uuid) TO authenticated;

-- Rollback script (commented out, for reference)
/*
-- To rollback this migration:
DROP VIEW IF EXISTS contacts_with_ooo_status;
DROP VIEW IF EXISTS active_auto_replies;
DROP FUNCTION IF EXISTS is_contact_auto_replying(uuid);
DROP INDEX IF EXISTS idx_contacts_id_auto_reply;
DROP INDEX IF EXISTS idx_contacts_auto_reply_until;
ALTER TABLE contacts DROP COLUMN IF EXISTS auto_reply_until;
*/
