-- Add gmail_message_id field to incoming_emails table for Gmail API integration
-- This stores the Gmail API message ID which is needed for trash/delete operations

ALTER TABLE incoming_emails
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Create index for faster lookups by Gmail message ID
CREATE INDEX IF NOT EXISTS idx_incoming_emails_gmail_message_id
ON incoming_emails(gmail_message_id);

-- Add comment
COMMENT ON COLUMN incoming_emails.gmail_message_id IS 'Gmail API message ID used for trash/delete operations via Gmail API';
