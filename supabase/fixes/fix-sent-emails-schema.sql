-- Fix for sent emails loading issue
-- This migration resolves schema conflicts between email_sends table definitions

-- First, check if the current email_sends table exists and what structure it has
-- We'll create a unified schema that matches the API expectations

-- Drop the inconsistent email_sends table if it exists
DROP TABLE IF EXISTS email_sends CASCADE;

-- Create the correct email_sends table structure matching API expectations and TypeScript types
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Email content
  subject VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  step_number INTEGER DEFAULT 1,

  -- Sending details
  message_id VARCHAR(255), -- Provider message ID
  send_status VARCHAR(20) DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed', 'scheduled')),

  -- Important timestamps for mailbox display
  sent_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- A/B testing
  ab_variant VARCHAR(20),

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Tracking data
  tracking_data JSONB DEFAULT '{}'
);

-- Create indexes for optimal performance
CREATE INDEX idx_email_sends_user_id ON email_sends(user_id);
CREATE INDEX idx_email_sends_campaign_id ON email_sends(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_email_sends_contact_id ON email_sends(contact_id);
CREATE INDEX idx_email_sends_email_account_id ON email_sends(email_account_id);
CREATE INDEX idx_email_sends_send_status ON email_sends(send_status);
CREATE INDEX idx_email_sends_sent_at ON email_sends(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_email_sends_created_at ON email_sends(created_at);

-- Composite index for mailbox queries (user + send status + dates)
CREATE INDEX idx_email_sends_mailbox_query ON email_sends(user_id, send_status, sent_at DESC NULLS LAST, created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_sends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_sends_updated_at_trigger
  BEFORE UPDATE ON email_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_email_sends_updated_at();

-- Insert some sample data for testing (if users and related tables exist)
-- This will help verify the mailbox functionality immediately

-- Insert sample data only if the required tables exist
DO $$
DECLARE
    test_user_id UUID;
    test_campaign_id UUID;
    test_contact_id UUID;
    test_account_id UUID;
BEGIN
    -- Check if we have any users first
    SELECT id INTO test_user_id FROM users LIMIT 1;

    IF test_user_id IS NOT NULL THEN
        -- Get or create test data
        SELECT id INTO test_campaign_id FROM campaigns WHERE user_id = test_user_id LIMIT 1;
        SELECT id INTO test_contact_id FROM contacts WHERE user_id = test_user_id LIMIT 1;
        SELECT id INTO test_account_id FROM email_accounts WHERE user_id = test_user_id LIMIT 1;

        -- Insert sample sent emails if we have the required data
        IF test_contact_id IS NOT NULL AND test_account_id IS NOT NULL THEN
            INSERT INTO email_sends (
                user_id,
                campaign_id,
                contact_id,
                email_account_id,
                subject,
                content,
                send_status,
                sent_at,
                message_id
            ) VALUES
            (
                test_user_id,
                test_campaign_id,
                test_contact_id,
                test_account_id,
                'Welcome to our service!',
                'Thank you for joining us. Here is your getting started guide...',
                'sent',
                NOW() - INTERVAL '2 hours',
                'test_message_id_001'
            ),
            (
                test_user_id,
                test_campaign_id,
                test_contact_id,
                test_account_id,
                'Follow up: Your account setup',
                'We wanted to follow up on your account setup process...',
                'delivered',
                NOW() - INTERVAL '1 day',
                'test_message_id_002'
            ),
            (
                test_user_id,
                NULL, -- Manual email without campaign
                test_contact_id,
                test_account_id,
                'Quick check-in',
                'Just wanted to check in and see how things are going...',
                'sent',
                NOW() - INTERVAL '3 days',
                'test_message_id_003'
            );

            RAISE NOTICE 'Sample email data inserted for testing mailbox functionality';
        ELSE
            RAISE NOTICE 'Cannot insert sample data - missing required related records (contacts or email_accounts)';
        END IF;
    ELSE
        RAISE NOTICE 'Cannot insert sample data - no users found';
    END IF;
END $$;

-- Add some helpful comments
COMMENT ON TABLE email_sends IS 'Stores all sent emails for mailbox display and tracking';
COMMENT ON COLUMN email_sends.send_status IS 'Email delivery status: pending, sent, delivered, bounced, failed, scheduled';
COMMENT ON COLUMN email_sends.sent_at IS 'Timestamp when email was actually sent (NULL for pending emails)';
COMMENT ON COLUMN email_sends.message_id IS 'Provider-specific message ID for tracking';
COMMENT ON COLUMN email_sends.tracking_data IS 'JSON data for opens, clicks, and other tracking events';

-- Verify the table structure
SELECT 'email_sends table created successfully with the following structure:' as status;
\d email_sends;