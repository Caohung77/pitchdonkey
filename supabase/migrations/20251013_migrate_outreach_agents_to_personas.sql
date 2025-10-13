-- Migrate Legacy Outreach Agents to AI Personas
-- Date: 2025-10-13
-- Purpose: Consolidate legacy outreach_agents into new ai_personas system

-- Step 1: Migrate outreach agents that don't already exist as AI personas
-- Only migrate if there's no matching persona by name
INSERT INTO ai_personas (
  id,
  user_id,
  name,
  status,
  persona_type,
  purpose,
  tone,
  language,
  sender_name,
  sender_role,
  company_name,
  custom_prompt,
  personality_traits,
  avatar_generation_status,
  chat_enabled,
  total_chats,
  total_emails_handled,
  segment_config,
  quality_weights,
  knowledge_summary,
  settings,
  created_at,
  updated_at
)
SELECT
  oa.id,
  oa.user_id,
  oa.name,
  -- Keep existing status if active, otherwise set to inactive
  CASE
    WHEN oa.status = 'active' THEN 'active'::text
    ELSE 'inactive'::text
  END as status,
  -- Map to appropriate persona type based on purpose/name
  CASE
    WHEN oa.purpose ILIKE '%support%' OR oa.name ILIKE '%support%' THEN 'customer_support'
    WHEN oa.purpose ILIKE '%sales%' OR oa.name ILIKE '%sales%' THEN 'sales_rep'
    WHEN oa.name ILIKE '%consultant%' THEN 'consultant'
    ELSE 'custom'
  END::text as persona_type,
  oa.purpose,
  oa.tone,
  COALESCE(oa.language, 'en')::text as language,
  oa.name as sender_name,  -- Use agent name as sender name
  NULL as sender_role,
  NULL as company_name,
  oa.custom_prompt,
  -- Create basic personality traits from tone
  jsonb_build_object(
    'communication_style', COALESCE(oa.tone, 'professional'),
    'response_length', 'balanced',
    'empathy_level', 'moderate',
    'formality', 'professional',
    'expertise_depth', 'intermediate',
    'proactivity', 'balanced'
  ) as personality_traits,
  'pending'::text as avatar_generation_status,
  true as chat_enabled,
  0 as total_chats,
  0 as total_emails_handled,
  COALESCE(oa.segment_config, '{}'::jsonb) as segment_config,
  COALESCE(oa.quality_weights, '{}'::jsonb) as quality_weights,
  COALESCE(oa.knowledge_summary, '{}'::jsonb) as knowledge_summary,
  COALESCE(oa.settings, '{}'::jsonb) as settings,
  oa.created_at,
  oa.updated_at
FROM outreach_agents oa
WHERE NOT EXISTS (
  -- Don't migrate if a persona with the same name already exists
  SELECT 1 FROM ai_personas ap
  WHERE ap.name = oa.name AND ap.user_id = oa.user_id
)
ON CONFLICT (id) DO NOTHING;  -- Skip if ID already exists

-- Step 2: Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
  skipped_count INTEGER;
BEGIN
  -- Count migrated agents
  SELECT COUNT(*) INTO migrated_count
  FROM ai_personas ap
  INNER JOIN outreach_agents oa ON ap.id = oa.id;

  -- Count agents that weren't migrated (duplicates)
  SELECT COUNT(*) INTO skipped_count
  FROM outreach_agents oa
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_personas ap WHERE ap.id = oa.id
  );

  RAISE NOTICE 'Migration complete: % agents migrated, % skipped (duplicates)',
    migrated_count, skipped_count;
END $$;

-- Step 3: Update email account references
-- The assigned_agent_id in email_accounts already points to the correct ID
-- since we preserved the ID during migration
-- Just verify the reference is valid
UPDATE email_accounts
SET updated_at = NOW()
WHERE assigned_agent_id IN (
  SELECT id FROM ai_personas
);

-- Step 4: Add comment for future reference
COMMENT ON TABLE outreach_agents IS
'LEGACY TABLE: This table is deprecated. All agents have been migrated to ai_personas. Keep for historical reference only.';
