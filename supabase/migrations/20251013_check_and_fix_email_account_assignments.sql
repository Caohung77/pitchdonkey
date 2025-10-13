-- Check and Fix Email Account Assignments
-- Date: 2025-10-13
-- Purpose: Since outreach_agents table doesn't exist, just ensure email accounts
--          reference ai_personas correctly

-- Step 1: Check if assigned_agent_id column exists in email_accounts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_accounts' AND column_name = 'assigned_agent_id'
  ) THEN
    RAISE NOTICE 'email_accounts.assigned_agent_id column exists';

    -- Check for any invalid references
    RAISE NOTICE 'Checking for invalid persona references...';

    -- Show current assignments
    RAISE NOTICE 'Current email account assignments:';
    FOR r IN
      SELECT
        ea.id,
        ea.email,
        ea.assigned_agent_id,
        ap.name as persona_name,
        ap.status as persona_status
      FROM email_accounts ea
      LEFT JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
      WHERE ea.assigned_agent_id IS NOT NULL
    LOOP
      IF r.persona_name IS NULL THEN
        RAISE NOTICE '  ❌ Email % has invalid reference: %', r.email, r.assigned_agent_id;
      ELSE
        RAISE NOTICE '  ✅ Email % assigned to: % (status: %)', r.email, r.persona_name, r.persona_status;
      END IF;
    END LOOP;

    -- Update any invalid references to NULL
    UPDATE email_accounts
    SET assigned_agent_id = NULL,
        updated_at = NOW()
    WHERE assigned_agent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ai_personas WHERE id = email_accounts.assigned_agent_id
      );

    GET DIAGNOSTICS r := ROW_COUNT;
    RAISE NOTICE 'Cleaned up % invalid references', r;

  ELSE
    RAISE NOTICE 'email_accounts.assigned_agent_id column does not exist';
  END IF;
END $$;

-- Step 2: Ensure all assigned personas are marked as active
UPDATE ai_personas
SET status = 'active',
    updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT assigned_agent_id
  FROM email_accounts
  WHERE assigned_agent_id IS NOT NULL
)
AND status != 'active';

-- Show results
SELECT
  'Active Personas Assigned to Email Accounts' as info,
  COUNT(DISTINCT ea.assigned_agent_id) as assigned_count
FROM email_accounts ea
WHERE ea.assigned_agent_id IS NOT NULL;
