-- Fix Email Account Persona Assignments (Simple Version)
-- Date: 2025-10-13
-- Purpose: Mark assigned personas as active and clean up invalid references

-- Step 1: Show current assignments (for logging)
DO $$
DECLARE
  assignment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO assignment_count
  FROM email_accounts
  WHERE assigned_agent_id IS NOT NULL;

  RAISE NOTICE 'Found % email accounts with assigned personas', assignment_count;
END $$;

-- Step 2: Clean up any invalid references (where persona doesn't exist)
UPDATE email_accounts
SET assigned_agent_id = NULL,
    updated_at = NOW()
WHERE assigned_agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ai_personas WHERE id = email_accounts.assigned_agent_id
  );

-- Step 3: Mark all assigned personas as active
UPDATE ai_personas
SET status = 'active',
    updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT assigned_agent_id
  FROM email_accounts
  WHERE assigned_agent_id IS NOT NULL
)
AND status != 'active';

-- Step 4: Show results
SELECT
  'Email Account Assignments' as info,
  ea.email,
  ap.name as assigned_persona,
  ap.status as persona_status
FROM email_accounts ea
INNER JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
WHERE ea.assigned_agent_id IS NOT NULL
ORDER BY ea.email;
