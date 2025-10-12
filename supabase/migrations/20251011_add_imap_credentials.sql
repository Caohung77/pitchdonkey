-- Migration: Add IMAP credentials to email_accounts table for SMTP sent folder sync
-- Purpose: Store IMAP settings to enable saving sent SMTP emails to mail server's Sent folder
-- Date: 2025-10-11

-- Add IMAP configuration columns to email_accounts table
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS imap_host TEXT,
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_username TEXT,
ADD COLUMN IF NOT EXISTS imap_password TEXT,
ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN DEFAULT true;

-- Add comment explaining the purpose
COMMENT ON COLUMN email_accounts.imap_host IS 'IMAP server host for reading emails and saving sent copies';
COMMENT ON COLUMN email_accounts.imap_port IS 'IMAP server port (typically 993 for SSL/TLS, 143 for STARTTLS)';
COMMENT ON COLUMN email_accounts.imap_username IS 'IMAP authentication username (usually same as SMTP username)';
COMMENT ON COLUMN email_accounts.imap_password IS 'IMAP authentication password (encrypted, usually same as SMTP password)';
COMMENT ON COLUMN email_accounts.imap_secure IS 'Whether to use SSL/TLS for IMAP connection';

-- Update existing SMTP accounts with default IMAP settings based on SMTP provider
-- Gmail SMTP accounts
UPDATE email_accounts
SET
  imap_host = 'imap.gmail.com',
  imap_port = 993,
  imap_username = smtp_username,
  imap_password = smtp_password,
  imap_secure = true
WHERE provider = 'smtp'
  AND smtp_host LIKE '%gmail%'
  AND imap_host IS NULL;

-- Outlook SMTP accounts
UPDATE email_accounts
SET
  imap_host = 'outlook.office365.com',
  imap_port = 993,
  imap_username = smtp_username,
  imap_password = smtp_password,
  imap_secure = true
WHERE provider = 'smtp'
  AND (smtp_host LIKE '%outlook%' OR smtp_host LIKE '%office365%')
  AND imap_host IS NULL;

-- Yahoo SMTP accounts
UPDATE email_accounts
SET
  imap_host = 'imap.mail.yahoo.com',
  imap_port = 993,
  imap_username = smtp_username,
  imap_password = smtp_password,
  imap_secure = true
WHERE provider = 'smtp'
  AND smtp_host LIKE '%yahoo%'
  AND imap_host IS NULL;

-- For other SMTP accounts, try to derive IMAP host from SMTP host
-- (e.g., smtp.example.com -> imap.example.com)
UPDATE email_accounts
SET
  imap_host = REPLACE(smtp_host, 'smtp.', 'imap.'),
  imap_port = 993,
  imap_username = smtp_username,
  imap_password = smtp_password,
  imap_secure = true
WHERE provider = 'smtp'
  AND smtp_host LIKE 'smtp.%'
  AND imap_host IS NULL;
