-- Fix integer overflow for incoming_emails.imap_uid column
-- Change from integer to bigint to support Gmail API message IDs
-- Gmail API message IDs when converted to numeric format can exceed INTEGER max value (2,147,483,647)

-- Drop existing index first
DROP INDEX IF EXISTS public.idx_incoming_emails_imap_uid;

-- Alter column type from integer to bigint
ALTER TABLE public.incoming_emails
  ALTER COLUMN imap_uid TYPE BIGINT;

-- Recreate index with bigint type
CREATE INDEX idx_incoming_emails_imap_uid ON public.incoming_emails(email_account_id, imap_uid);

-- Also update imap_connections.last_processed_uid to bigint
ALTER TABLE public.imap_connections
  ALTER COLUMN last_processed_uid TYPE BIGINT;

-- Add comment explaining the change
COMMENT ON COLUMN public.incoming_emails.imap_uid IS 'IMAP UID as BIGINT to support Gmail API message IDs (can exceed 2^31-1)';
COMMENT ON COLUMN public.imap_connections.last_processed_uid IS 'Last processed UID as BIGINT to support Gmail API message IDs';