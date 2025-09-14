-- Add domain verification columns to email_accounts table
-- This allows email accounts to show verification status directly without complex joins

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS spf_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dkim_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dmarc_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ;

-- Add index for efficient filtering by verification status
CREATE INDEX IF NOT EXISTS idx_email_accounts_verification 
ON email_accounts (spf_verified, dkim_verified, dmarc_verified);

-- Add comment for documentation
COMMENT ON COLUMN email_accounts.spf_verified IS 'Whether SPF record is verified for this email account domain';
COMMENT ON COLUMN email_accounts.dkim_verified IS 'Whether DKIM record is verified for this email account domain';  
COMMENT ON COLUMN email_accounts.dmarc_verified IS 'Whether DMARC record is verified for this email account domain';
COMMENT ON COLUMN email_accounts.domain_verified_at IS 'Timestamp when domain verification was last performed';