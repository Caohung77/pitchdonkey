-- Migration: Transform Outreach Agents to AI Personas
-- Description: Rename tables and add new columns for personality, avatars, and chat functionality
-- Version: v0.23.0
-- Date: 2025-10-12

-- Step 1: Rename the main table
ALTER TABLE IF EXISTS outreach_agents RENAME TO ai_personas;

-- Step 2: Rename the knowledge table
ALTER TABLE IF EXISTS outreach_agent_knowledge RENAME TO ai_persona_knowledge;

-- Step 3: Rename the segment members table
ALTER TABLE IF EXISTS agent_segment_members RENAME TO persona_segment_members;

-- Step 4: Rename the contact scores table
ALTER TABLE IF EXISTS agent_contact_scores RENAME TO persona_contact_scores;

-- Step 5: Add new columns to ai_personas table
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS persona_type VARCHAR(50) DEFAULT 'sales_rep' CHECK (persona_type IN (
  'customer_support',
  'sales_rep',
  'sales_development',
  'account_manager',
  'consultant',
  'technical_specialist',
  'success_manager',
  'marketing_specialist'
));

ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '{
  "communication_style": "professional",
  "response_length": "balanced",
  "empathy_level": "moderate",
  "formality": "professional",
  "expertise_depth": "intermediate",
  "proactivity": "balanced"
}'::jsonb;

ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS avatar_prompt TEXT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS avatar_generation_status VARCHAR(20) DEFAULT 'pending' CHECK (avatar_generation_status IN ('pending', 'generating', 'completed', 'failed'));
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS avatar_metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS total_chats INTEGER DEFAULT 0;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS total_emails_handled INTEGER DEFAULT 0;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS average_response_time_ms INTEGER;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS satisfaction_score DECIMAL(3,2);

-- Step 6: Update foreign key references in knowledge table
ALTER TABLE ai_persona_knowledge
  DROP CONSTRAINT IF EXISTS outreach_agent_knowledge_agent_id_fkey;

ALTER TABLE ai_persona_knowledge
  ADD CONSTRAINT ai_persona_knowledge_persona_id_fkey
  FOREIGN KEY (agent_id) REFERENCES ai_personas(id) ON DELETE CASCADE;

-- Rename the agent_id column to persona_id for clarity
ALTER TABLE ai_persona_knowledge
  RENAME COLUMN agent_id TO persona_id;

-- Step 7: Update foreign key references in segment members table
ALTER TABLE persona_segment_members
  DROP CONSTRAINT IF EXISTS agent_segment_members_agent_id_fkey;

ALTER TABLE persona_segment_members
  ADD CONSTRAINT persona_segment_members_persona_id_fkey
  FOREIGN KEY (agent_id) REFERENCES ai_personas(id) ON DELETE CASCADE;

ALTER TABLE persona_segment_members
  RENAME COLUMN agent_id TO persona_id;

-- Step 8: Update foreign key references in contact scores table
ALTER TABLE persona_contact_scores
  DROP CONSTRAINT IF EXISTS agent_contact_scores_agent_id_fkey;

ALTER TABLE persona_contact_scores
  ADD CONSTRAINT persona_contact_scores_persona_id_fkey
  FOREIGN KEY (agent_id) REFERENCES ai_personas(id) ON DELETE CASCADE;

ALTER TABLE persona_contact_scores
  RENAME COLUMN agent_id TO persona_id;

-- Step 9: Rename indexes
DROP INDEX IF EXISTS outreach_agents_user_id_idx;
DROP INDEX IF EXISTS outreach_agents_status_idx;
DROP INDEX IF EXISTS outreach_agent_knowledge_agent_idx;
DROP INDEX IF EXISTS outreach_agent_knowledge_user_idx;

CREATE INDEX IF NOT EXISTS ai_personas_user_id_idx ON ai_personas(user_id);
CREATE INDEX IF NOT EXISTS ai_personas_status_idx ON ai_personas(status);
CREATE INDEX IF NOT EXISTS ai_personas_persona_type_idx ON ai_personas(persona_type);
CREATE INDEX IF NOT EXISTS ai_personas_avatar_status_idx ON ai_personas(avatar_generation_status);
CREATE INDEX IF NOT EXISTS ai_persona_knowledge_persona_idx ON ai_persona_knowledge(persona_id);
CREATE INDEX IF NOT EXISTS ai_persona_knowledge_user_idx ON ai_persona_knowledge(user_id);

-- Step 10: Create chat sessions table for persistent chat history
CREATE TABLE IF NOT EXISTS ai_persona_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_name VARCHAR(255),
  messages JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ai_persona_chat_sessions_persona_idx ON ai_persona_chat_sessions(persona_id);
CREATE INDEX IF NOT EXISTS ai_persona_chat_sessions_user_idx ON ai_persona_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_persona_chat_sessions_active_idx ON ai_persona_chat_sessions(is_active);

-- Step 11: Create email interactions table for tracking persona email performance
CREATE TABLE IF NOT EXISTS ai_persona_email_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_send_id UUID REFERENCES email_sends(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  interaction_type VARCHAR(50) CHECK (interaction_type IN ('outbound', 'reply', 'follow_up', 'auto_reply')),
  email_subject TEXT,
  email_body TEXT,
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  personality_applied JSONB,
  response_time_ms INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  sentiment_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_persona_email_interactions_persona_idx ON ai_persona_email_interactions(persona_id);
CREATE INDEX IF NOT EXISTS ai_persona_email_interactions_user_idx ON ai_persona_email_interactions(user_id);
CREATE INDEX IF NOT EXISTS ai_persona_email_interactions_contact_idx ON ai_persona_email_interactions(contact_id);
CREATE INDEX IF NOT EXISTS ai_persona_email_interactions_type_idx ON ai_persona_email_interactions(interaction_type);

-- Step 12: Create trigger to update timestamp on ai_personas
CREATE OR REPLACE FUNCTION update_ai_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_personas_updated_at ON ai_personas;
CREATE TRIGGER update_ai_personas_updated_at
  BEFORE UPDATE ON ai_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_personas_updated_at();

-- Step 13: Create trigger to update timestamp on chat sessions
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON ai_persona_chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON ai_persona_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_personas_updated_at();

-- Step 14: Migrate existing data to new structure
UPDATE ai_personas
SET persona_type = 'sales_rep'
WHERE persona_type IS NULL;

-- Step 15: Update email_accounts table to reference ai_personas instead of outreach_agents
ALTER TABLE email_accounts
  DROP CONSTRAINT IF EXISTS email_accounts_assigned_agent_id_fkey;

ALTER TABLE email_accounts
  RENAME COLUMN assigned_agent_id TO assigned_persona_id;

ALTER TABLE email_accounts
  ADD CONSTRAINT email_accounts_assigned_persona_id_fkey
  FOREIGN KEY (assigned_persona_id) REFERENCES ai_personas(id) ON DELETE SET NULL;

-- Step 16: Add comment documenting the migration
COMMENT ON TABLE ai_personas IS 'AI Personas - Renamed from outreach_agents. Each persona represents an AI employee with unique personality, avatar, and capabilities.';
COMMENT ON TABLE ai_persona_chat_sessions IS 'Chat sessions between users and AI personas for testing and interaction.';
COMMENT ON TABLE ai_persona_email_interactions IS 'Tracks all email interactions handled by AI personas for performance monitoring.';
