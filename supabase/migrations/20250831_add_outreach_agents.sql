-- Outreach Agents Core Tables
-- Adds support for AI-powered outreach agents, knowledge documents, scoring runs, and segment members.

-- Outreach agents main table
CREATE TABLE IF NOT EXISTS outreach_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  purpose TEXT,
  tone VARCHAR(50) DEFAULT 'friendly',
  last_used_at TIMESTAMP WITH TIME ZONE,
  sender_name VARCHAR(255),
  sender_role VARCHAR(255),
  company_name VARCHAR(255),
  product_one_liner TEXT,
  product_description TEXT,
  unique_selling_points TEXT[] DEFAULT '{}',
  target_persona TEXT,
  conversation_goal VARCHAR(255),
  preferred_cta VARCHAR(255),
  follow_up_strategy VARCHAR(255),
  knowledge_summary JSONB DEFAULT '{}',
  segment_config JSONB DEFAULT '{}',
  quality_weights JSONB DEFAULT '{}',
  custom_prompt TEXT,
  prompt_override TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_agents_user_id_idx ON outreach_agents(user_id);
CREATE INDEX IF NOT EXISTS outreach_agents_status_idx ON outreach_agents(status);

-- Knowledge documents attached to an agent
CREATE TABLE IF NOT EXISTS outreach_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pdf', 'doc', 'text', 'link', 'html')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT,
  storage_path TEXT,
  embedding_status VARCHAR(20) DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed')),
  embedding_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_agent_knowledge_agent_idx ON outreach_agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS outreach_agent_knowledge_user_idx ON outreach_agent_knowledge(user_id);

-- Per-contact scoring snapshots for an agent
CREATE TABLE IF NOT EXISTS agent_contact_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  reasons JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_contact_scores_unique_idx ON agent_contact_scores(agent_id, contact_id, run_id);
CREATE INDEX IF NOT EXISTS agent_contact_scores_agent_idx ON agent_contact_scores(agent_id);
CREATE INDEX IF NOT EXISTS agent_contact_scores_run_idx ON agent_contact_scores(run_id);

-- Tracks which contacts are currently selected/excluded for an agent's segment
CREATE TABLE IF NOT EXISTS agent_segment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'excluded', 'sent', 'failed')),
  score NUMERIC(5,2),
  reasons JSONB DEFAULT '[]',
  run_id UUID,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_segment_members_unique_idx ON agent_segment_members(agent_id, contact_id);
CREATE INDEX IF NOT EXISTS agent_segment_members_status_idx ON agent_segment_members(status);
CREATE INDEX IF NOT EXISTS agent_segment_members_run_idx ON agent_segment_members(run_id);

-- Trigger to keep outreach_agents.updated_at fresh
CREATE OR REPLACE FUNCTION touch_outreach_agents()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_outreach_agents ON outreach_agents;
CREATE TRIGGER trg_touch_outreach_agents
BEFORE UPDATE ON outreach_agents
FOR EACH ROW
EXECUTE FUNCTION touch_outreach_agents();

-- Trigger to maintain knowledge summary counts
CREATE OR REPLACE FUNCTION update_outreach_agent_knowledge_summary()
RETURNS TRIGGER AS $$
DECLARE
  knowledge_counts JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'ready', COUNT(*) FILTER (WHERE embedding_status = 'ready'),
    'pending', COUNT(*) FILTER (WHERE embedding_status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE embedding_status = 'processing'),
    'failed', COUNT(*) FILTER (WHERE embedding_status = 'failed')
  ) INTO knowledge_counts
  FROM outreach_agent_knowledge
  WHERE agent_id = COALESCE(NEW.agent_id, OLD.agent_id);

  UPDATE outreach_agents
  SET knowledge_summary = COALESCE(knowledge_counts, '{}')::jsonb,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_insert ON outreach_agent_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_update ON outreach_agent_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_delete ON outreach_agent_knowledge;

CREATE TRIGGER trg_update_agent_knowledge_summary_insert
AFTER INSERT ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();

CREATE TRIGGER trg_update_agent_knowledge_summary_update
AFTER UPDATE ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();

CREATE TRIGGER trg_update_agent_knowledge_summary_delete
AFTER DELETE ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();
