-- Add outreach agent linkage to email accounts
-- This enables persona-based AI email summaries

-- Add foreign key column to link email account to outreach agent
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS outreach_agent_id UUID REFERENCES outreach_agents(id) ON DELETE SET NULL;

-- Add index for efficient agent lookup
CREATE INDEX IF NOT EXISTS idx_email_accounts_outreach_agent
ON email_accounts(outreach_agent_id)
WHERE outreach_agent_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN email_accounts.outreach_agent_id IS 'Links email account to an outreach agent for persona-based AI email summaries. When emails are received on this account, AI summaries will be generated using the agent''s persona, purpose, and context.';
