-- Fix AI persona knowledge summary triggers after outreach_agents rename
-- Purpose: ensure cascading deletes/updates work now that tables use ai_persona_* names
-- Date: 2025-10-14

BEGIN;

-- Drop legacy triggers still pointing at the old summary function (if they exist)
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_insert ON ai_persona_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_update ON ai_persona_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_delete ON ai_persona_knowledge;

-- Replace legacy function that referenced outreach_agent_* tables
DROP FUNCTION IF EXISTS update_outreach_agent_knowledge_summary();

CREATE OR REPLACE FUNCTION update_ai_persona_knowledge_summary()
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
  )
  INTO knowledge_counts
  FROM ai_persona_knowledge
  WHERE persona_id = COALESCE(NEW.persona_id, OLD.persona_id);

  UPDATE ai_personas
  SET knowledge_summary = COALESCE(knowledge_counts, '{}')::jsonb,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.persona_id, OLD.persona_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach new triggers using the updated function
CREATE TRIGGER trg_update_ai_persona_knowledge_summary_insert
AFTER INSERT ON ai_persona_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_ai_persona_knowledge_summary();

CREATE TRIGGER trg_update_ai_persona_knowledge_summary_update
AFTER UPDATE ON ai_persona_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_ai_persona_knowledge_summary();

CREATE TRIGGER trg_update_ai_persona_knowledge_summary_delete
AFTER DELETE ON ai_persona_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_ai_persona_knowledge_summary();

COMMIT;
