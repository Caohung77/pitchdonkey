-- IMAP Email Processing Database Schema Extension
-- Run this in your Supabase SQL Editor to add IMAP functionality

-- Incoming emails table (raw email storage)
CREATE TABLE IF NOT EXISTS public.incoming_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  -- Email metadata
  message_id TEXT UNIQUE NOT NULL,
  in_reply_to TEXT,
  email_references TEXT,
  thread_id TEXT,
  
  -- Email headers
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT,
  date_received TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Email content
  text_content TEXT,
  html_content TEXT,
  attachments JSONB DEFAULT '[]',
  
  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  classification_status VARCHAR(50) DEFAULT 'unclassified' CHECK (classification_status IN ('unclassified', 'bounce', 'auto_reply', 'human_reply', 'unsubscribe', 'spam')),
  
  -- Processing metadata
  processed_at TIMESTAMP WITH TIME ZONE,
  classification_confidence DECIMAL(3,2), -- 0.00 to 1.00
  processing_errors TEXT[],
  
  -- Raw email data
  raw_email TEXT, -- Full raw email for debugging
  email_size INTEGER,
  
  -- Indexing and timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email replies table (processed replies with context)
CREATE TABLE IF NOT EXISTS public.email_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  incoming_email_id UUID NOT NULL REFERENCES public.incoming_emails(id) ON DELETE CASCADE,
  
  -- Link to original campaign
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  original_message_id TEXT, -- Link to outgoing email
  
  -- Reply classification
  reply_type VARCHAR(50) NOT NULL CHECK (reply_type IN ('bounce', 'auto_reply', 'human_reply', 'unsubscribe', 'complaint')),
  reply_subtype VARCHAR(100), -- More specific classification (e.g., 'out_of_office', 'hard_bounce', 'interest')
  
  -- Reply content analysis
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'unknown')),
  intent VARCHAR(50), -- 'interested', 'not_interested', 'request_removal', 'question', etc.
  keywords TEXT[],
  
  -- Auto-reply specific data
  auto_reply_until TIMESTAMP WITH TIME ZONE, -- For vacation messages
  forwarded_to TEXT, -- If message was forwarded
  
  -- Bounce specific data
  bounce_type VARCHAR(20) CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_code TEXT,
  bounce_reason TEXT,
  
  -- Processing metadata
  confidence_score DECIMAL(3,2), -- How confident we are in the classification
  requires_human_review BOOLEAN DEFAULT false,
  human_reviewed_at TIMESTAMP WITH TIME ZONE,
  human_reviewer_id UUID REFERENCES public.users(id),
  
  -- Action taken
  action_taken VARCHAR(100), -- 'contact_updated', 'campaign_paused', 'notification_sent', etc.
  action_taken_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email processing jobs table (for background processing queue)
CREATE TABLE IF NOT EXISTS public.email_processing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('imap_sync', 'email_classification', 'reply_processing')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Job configuration
  job_config JSONB DEFAULT '{}',
  
  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Results and errors
  result_summary JSONB DEFAULT '{}',
  error_details TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IMAP connection status table
CREATE TABLE IF NOT EXISTS public.imap_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_account_id UUID UNIQUE NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  -- Connection status
  status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Sync configuration
  sync_interval_minutes INTEGER DEFAULT 15,
  folders_to_monitor TEXT[] DEFAULT ARRAY['INBOX'],
  
  -- Statistics
  total_emails_processed INTEGER DEFAULT 0,
  last_processed_uid INTEGER DEFAULT 0,
  
  -- Connection health
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_successful_connection TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incoming_emails_user_id ON public.incoming_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_email_account_id ON public.incoming_emails(email_account_id);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_message_id ON public.incoming_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_in_reply_to ON public.incoming_emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_processing_status ON public.incoming_emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_classification_status ON public.incoming_emails(classification_status);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_date_received ON public.incoming_emails(date_received DESC);

CREATE INDEX IF NOT EXISTS idx_email_replies_user_id ON public.email_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_campaign_id ON public.email_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_contact_id ON public.email_replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_reply_type ON public.email_replies(reply_type);
CREATE INDEX IF NOT EXISTS idx_email_replies_sentiment ON public.email_replies(sentiment);
CREATE INDEX IF NOT EXISTS idx_email_replies_requires_review ON public.email_replies(requires_human_review);

CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_status ON public.email_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_user_id ON public.email_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_next_retry ON public.email_processing_jobs(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_imap_connections_status ON public.imap_connections(status);
CREATE INDEX IF NOT EXISTS idx_imap_connections_next_sync ON public.imap_connections(next_sync_at);

-- Enable Row Level Security
ALTER TABLE public.incoming_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imap_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Incoming emails policies
CREATE POLICY "Users can view own incoming emails" ON public.incoming_emails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incoming emails" ON public.incoming_emails FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incoming emails" ON public.incoming_emails FOR UPDATE USING (auth.uid() = user_id);

-- Email replies policies
CREATE POLICY "Users can view own email replies" ON public.email_replies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email replies" ON public.email_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email replies" ON public.email_replies FOR UPDATE USING (auth.uid() = user_id);

-- Email processing jobs policies
CREATE POLICY "Users can view own processing jobs" ON public.email_processing_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own processing jobs" ON public.email_processing_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own processing jobs" ON public.email_processing_jobs FOR UPDATE USING (auth.uid() = user_id);

-- IMAP connections policies
CREATE POLICY "Users can view own IMAP connections" ON public.imap_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own IMAP connections" ON public.imap_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own IMAP connections" ON public.imap_connections FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incoming_emails_updated_at BEFORE UPDATE ON public.incoming_emails FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_replies_updated_at BEFORE UPDATE ON public.email_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_processing_jobs_updated_at BEFORE UPDATE ON public.email_processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_imap_connections_updated_at BEFORE UPDATE ON public.imap_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();