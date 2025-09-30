-- Create outgoing_emails table to store sent emails (mirror of incoming_emails)
-- This enables fast querying of sent emails without hitting Gmail API repeatedly

CREATE TABLE IF NOT EXISTS public.outgoing_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  cc_address TEXT,
  bcc_address TEXT,
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  date_sent TIMESTAMPTZ NOT NULL,
  imap_uid BIGINT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uniq_outgoing_emails_message_id UNIQUE (message_id),
  CONSTRAINT uniq_outgoing_emails_account_uid UNIQUE (email_account_id, imap_uid)
);

-- Create indexes for performance
CREATE INDEX idx_outgoing_emails_user_id ON public.outgoing_emails(user_id);
CREATE INDEX idx_outgoing_emails_account_id ON public.outgoing_emails(email_account_id);
CREATE INDEX idx_outgoing_emails_date_sent ON public.outgoing_emails(date_sent DESC);
CREATE INDEX idx_outgoing_emails_subject ON public.outgoing_emails USING gin(to_tsvector('english', subject));
CREATE INDEX idx_outgoing_emails_to_address ON public.outgoing_emails(to_address);

-- Enable Row Level Security
ALTER TABLE public.outgoing_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own sent emails
CREATE POLICY "Users can view their own sent emails"
  ON public.outgoing_emails
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sent emails"
  ON public.outgoing_emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sent emails"
  ON public.outgoing_emails
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sent emails"
  ON public.outgoing_emails
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_outgoing_emails_updated_at
  BEFORE UPDATE ON public.outgoing_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.outgoing_emails IS 'Stores sent emails fetched from Gmail SENT folder';
COMMENT ON COLUMN public.outgoing_emails.imap_uid IS 'IMAP UID as BIGINT to support Gmail API message IDs (hash of Gmail message ID)';
COMMENT ON COLUMN public.outgoing_emails.message_id IS 'Gmail Message-ID header (used for duplicate detection)';
COMMENT ON COLUMN public.outgoing_emails.date_sent IS 'Date when email was sent';
