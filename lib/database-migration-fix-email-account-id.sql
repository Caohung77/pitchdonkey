-- Migration: Fix missing email_account_id column in campaigns table
-- This migration adds the missing email_account_id column that the cron job expects

-- Add the missing email_account_id column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_email_account_id ON campaigns(email_account_id);

-- Comment
COMMENT ON COLUMN campaigns.email_account_id IS 'Email account to use for sending this campaign';

-- Update existing campaigns to use a default email account if available
-- This is a safe operation that will help existing campaigns work
DO $$
DECLARE
    default_account_id UUID;
BEGIN
    -- Find the first active email account for each user
    FOR default_account_id IN
        SELECT DISTINCT ON (ea.user_id) ea.id
        FROM email_accounts ea
        WHERE ea.status = 'active'
        ORDER BY ea.user_id, ea.created_at ASC
    LOOP
        -- Update campaigns that don't have an email account set
        UPDATE campaigns
        SET email_account_id = default_account_id
        WHERE email_account_id IS NULL
        AND user_id = (SELECT user_id FROM email_accounts WHERE id = default_account_id);
    END LOOP;
END $$;

-- Show the result
SELECT
    'Updated campaigns with email_account_id' as action,
    count(*) as affected_rows
FROM campaigns
WHERE email_account_id IS NOT NULL;