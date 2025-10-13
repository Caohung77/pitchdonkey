-- Set All AI Personas to Inactive
-- Date: 2025-10-13
-- Reason: Email account assignment feature not yet implemented
--         All personas should be inactive until they can be properly assigned

-- Update all personas to inactive
UPDATE ai_personas
SET status = 'inactive',
    updated_at = NOW()
WHERE status != 'inactive';

-- Show results
SELECT
  name,
  sender_name,
  status,
  persona_type,
  'Status updated - assignment feature pending' as note
FROM ai_personas
ORDER BY name;
